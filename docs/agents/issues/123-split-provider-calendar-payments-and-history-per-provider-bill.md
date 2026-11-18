## Description

Sub-issue of epic [#119 — Refactor providers](https://github.com/darthjee/ward/issues/119).
Make the Calendar, overdue list, payment writer and bill history work **per provider bill**
instead of per provider account. Builds against
`docs/agents/specs/split-provider/api/payments.md` and `migration.md`. Requires the expand
migration and the `provider-bills` CRUD API (`ProviderBillResolver`).

## Problem

`billSourceOf()` (`backend/src/bank/bill-schedule.ts`) builds one `BillSource` per provider from
`bank_provider_expense_details`; `CalendarService` keys payments by
`${sourceAccountId}:${dueDate}`; history and off-schedule detection are per account. A provider
with several recurring bills therefore still produces a single series, and two bills due the same
day would be indistinguishable.

## Expected Behavior

- `calendar.query.ts` loads recurring bills in **one query**
  (`provider_account_id IN (…) AND kind = 'recurring'`) and builds one `BillSchedule` per bill
  (new `provider-bill.schedule.ts`); `occurrence-generator.ts` is reused unchanged. One-off
  bills keep producing one occurrence on `due_date`.
- Each occurrence gains `source_bill: { id, description } | null` (set for provider bills and
  one-offs, `null` for debts). **`kind` stays `'provider'`** for recurring provider-bill
  occurrences — the shipped frontend relies on `CHARGE_KINDS = ['provider', 'bill']`; the rename
  to `provider_bill` happens in the contract sub-issue.
- Payment map key is `${providerBillId}:${nominal}` for provider bills, unchanged for debts; the
  sort comparator uses the bill id as tie-breaker before the account id.
- New routes:
  ```text
  GET    <base>/provider-bills/:id/bill-payments.json?page=
  POST   <base>/provider-bills/:id/occurrences/:dueDate/payment.json
  DELETE <base>/provider-bills/:id/occurrences/:dueDate/payment.json
  ```
  serving both kinds. On `POST`, `:dueDate` must be a real nominal occurrence of that bill
  (generator check for recurring, equality with `due_date` for one-off), else `404`. `DELETE`
  keeps the #56 rule (see [Edge cases](#edge-cases)). The writer locks the
  `ProviderBill` row `FOR UPDATE`; `PaymentTarget` gains `providerBillId` and `find()` a third
  branch. Same bill + date twice → `409 OCCURRENCE_ALREADY_PAID`; two bills of one provider on
  the same date both succeed. Paying writes the same three transactions as today.
- History per bill; `off_schedule` computed against that bill's own schedule.
- **Compatibility aliases**: the account-level provider pay and undo routes
  (`accounts/:accountId/occurrences/:dueDate/payment.json`) resolve to the provider's single
  recurring bill; with zero or several → `404`. Account-level history
  (`accounts/:accountId/bill-payments.json`) is **not** an alias: it stays account-wide (see
  [Backward compatibility](#backward-compatibility)). Debt routes are unchanged.
- The provider-expense details response reads its schedule fields from the single recurring
  bill, falls back to the details row with zero, and is `null` with several (see
  [Provider-expense details response](#provider-expense-details-response)).
- 366-day and 1000-occurrence caps checked on occurrences. Accountant hand-off, balances and
  ledger are byte-identical for existing data (see
  [Data sensitivity & ownership](#data-sensitivity--ownership) for the label of new payments).

## Data sensitivity & ownership

- **Ownership is unchanged** (`security.md`). All new routes and aliases sit under
  `@OwnerScopedController` on both `<base>` paths with `@StrictBody()`. On organization routes any
  member may pay, undo or read history, since roles are not enforced until #81 and no new role
  logic is added. Non-members, including a global admin who is not a member, get the uniform `404`.
  Paying accounts go through `PayingAccountResolver`, which answers a generic `422` without echoing
  ids.
- **Exposure.** `source_bill` carries only `{ id, description }` of the caller's own bill. `notes`
  never appears in occurrence or history payloads (explicit mappers, no entity spread).
- **Ledger label.** A recurring provider-bill payment's transactions are described
  `"<bill description> — <nominal due date>"`, as one-offs already are, instead of the account
  name. The label is passed through `paymentDescription()`, so the 255-code-point cut still
  applies. This text reaches the accountant hand-off, so a bill's description becomes visible to
  the accountant, just as one-off descriptions already are; `notes` never does.
  - A backfilled bill's description equals the account name, so new payments look the same until a
    bill is renamed or a second recurring bill is added.
  - Existing transactions are never rewritten.
  - `accountant.e2e-spec.ts` stays green unchanged.
  - Add a writer spec case: two bills of one provider paid on the same date get distinct
    descriptions.

## Backward compatibility

- **Account-level history stays account-wide.** For a provider,
  `GET <base>/accounts/:accountId/bill-payments.json` keeps returning **every** payment row of the
  account, as today:
  - every bill's payments (both kinds), plus orphaned rows with `provider_bill_id IS NULL`;
  - newest `due_date` first, then newest id; 50 per page;
  - `200` with zero or several recurring bills, and on an archived provider.

  Only `off_schedule` changes. It is computed per row against that row's own recurring bill's
  schedule, `false` for one-offs, and against the details row's schedule for orphans. The route is
  removed for providers in #125 along with the other account-level provider routes. Update
  `api/payments.md` ("Transition aliases"), which currently lists history among the aliases.
- **The pay and undo aliases are unchanged in practice.** A provider without a recurring bill
  already answers `404` today, because no date is an occurrence. "Several recurring bills" is new
  since #122.
- **The one-off payment routes stay.** `POST/DELETE <base>/bills/:id/payment.json` keep working
  unchanged until #125, because the shipped frontend uses them. They go through the same writer
  path as the per-bill routes: same `ProviderBill` `FOR UPDATE` lock and same payment row. Paying
  a one-off through one route and then the other answers `409 OCCURRENCE_ALREADY_PAID`, and undo
  works from either route. Add an e2e case that pays through one route and then the other. List
  these routes in `api/payments.md` next to the transition aliases, removed in #125.
- **History row shape.** `bill: { id, description } | null` keeps exactly its current meaning
  (set for one-offs only). A new `source_bill: { id, description } | null` is set on every
  provider-bill row (both kinds) and is `null` for debt and orphan rows. It matches the occurrence
  payload, and both the per-bill and account-level history routes use this shape. `notes` never
  appears.
- Tests (`bill-history.spec.ts`, `bill-payments.e2e-spec.ts`): account-level history with zero,
  one and several recurring bills plus one-offs; `off_schedule` per bill (editing bill A never
  flags bill B's rows); `source_bill` presence; the existing account-history e2e cases still pass
  unchanged except for the added field.

## Edge cases

- **Undo keeps the #56 rule.** `DELETE …/provider-bills/:id/occurrences/:dueDate/payment.json`
  only needs a valid `YYYY-MM-DD` date and an existing payment row for `(bill, date)`. It does
  **not** require the date to still be a nominal occurrence, so a payment that drifted
  off-schedule can still be undone. The nominal-occurrence check applies to `POST` only. Update
  `docs/agents/specs/split-provider/security.md` (the `:dueDate` row) and `api/payments.md` to
  match.
- **Races (closes the #122 known gap).** The writer locks the `ProviderBill` row `FOR UPDATE`,
  re-reads it, and answers `404` if a concurrent `DELETE` removed it. It then re-checks the
  occurrence against the locked row's schedule and answers `404` if a concurrent `PATCH` moved it.
  A bill `DELETE` that arrives after the lock waits for it, so its cascade sees the committed
  payment. Integration tests (MySQL): delete-vs-pay and patch-vs-pay.
- **Orphaned provider payments.** Rows with `provider_bill_id IS NULL` from a provider-expense
  source can exist if a payment was made after #122 (the recurring bill deleted while the details
  still carried `due_day`) and before this issue ships. They are **left as is**. They no longer
  appear in the calendar, overdue or history, and their ledger transactions are untouched. No
  migration. Document them as a known leftover in `migration.md`.
- **Hidden or inactive bills.** A bill with `show_in_calendar: false`, before `bills_from`, or
  under an archived provider is not payable (`404`), just as `isNominalOccurrence` treats the
  account route today.
- **No expected amount.** Nothing to add: `amount` is already required on every payment
  (`payment-body.ts`).

## Performance & security

Most of this is already decided in `docs/agents/specs/split-provider/security.md`: uniform `404`,
every `409` only after the owner-scoped resolve, the 366-day generator window, calendar and overdue
loaded in one query, and a per-bill lock. A `:dueDate` that is not an occurrence answers the same
uniform `404`, so it reveals nothing. In addition:

- **Archived providers keep today's behavior** on both the per-bill routes and the aliases, so the
  aliases stay byte-compatible:

  | Route | Archived provider |
  |---|---|
  | `GET …/bill-payments.json` | `200` (resolve with `allowArchived`) |
  | `DELETE …/payment.json` | resolve with `allowArchived`, then the #56 checks: skip → `404`, payment → `409 ACCOUNT_ARCHIVED` |
  | `POST …/payment.json` | `404` (inactive schedule) |

  Everything else (unknown, foreign, other context, debt id) still answers the uniform `404`.
  e2e coverage over both base paths.
- **Lock order** is provider (only when needed) → provider bill → paying account (share). It
  matches the #122 write-through and bill `PATCH`/`DELETE`, and the writer never locks the provider
  after the bill. Document it in `docs/agents/modules/bank/bills.md`. MySQL integration test:
  concurrent pay and bill `PATCH` complete without a deadlock.
- History pages read `(provider_bill_id, due_date)` through the existing unique index (newest
  first, 50 per page). The alias lookup adds a single query.

## Provider-expense details response

The write side is already gated by #122 (`409 PROVIDER_HAS_MULTIPLE_BILLS` on a schedule field
with two or more recurring bills). This issue moves the **read** side. The seven schedule fields
of the nested `provider_expense` object (`expected_amount`, `charge_frequency`, `due_day`,
`due_month`, `bills_from`, `show_in_calendar`, `paying_account`) come from:

| Recurring bills | Source |
|---|---|
| Exactly one | That bill, as stored, including a bill hidden by a cleared `due_day`: the response shows its last `due_day` with `show_in_calendar: false`. This quirk is accepted until #125 drops the provider schedule fields. |
| Zero | The `bank_provider_expense_details` row, as today. A provider with `expected_amount` and no `due_day` has no bill, so what the client sent still round-trips. |
| Two or more | All seven are `null`. |

- The `provider_expense` object is always present, and `for_accountant` and `provider_tax_id` are
  always read from the details row.
- `ProviderExpenseResponse` becomes nullable for `charge_frequency` and `show_in_calendar`, which
  are non-nullable today. #124 makes the frontend handle a `null` schedule.
- Recurring bills and their paying-account refs are loaded in batch for account lists (no N+1).
- Update `migration.md` ("Reads (from #123)" and the #123 test list) in the same PR: it currently says `null` with zero
  bills.
- Tests (`provider-expense-accounts.e2e-spec.ts`): one bill edited through `provider-bills` is
  reflected; a hidden bill after clearing `due_day`; zero bills with `expected_amount` only; two
  recurring bills give all seven `null`.

## Solution

Owned by the `backend` agent; the `cache` agent reviews the cache classes from `api/payments.md` (Navi warms none of the new routes). Files:
`bill-schedule.ts` (`billSourceOfProviderBill`), `calendar.query.ts`, `calendar.service.ts`,
`bill-payment.writer.ts`, `bill-history.service.ts`, `occurrence-response.ts`, new
`provider-bill.schedule.ts`, the payments controller. Tests: extend `occurrences.spec.ts`,
`calendar-units.spec.ts`, `bill-history.spec.ts`, `bill-payment.writer.spec.ts`,
`bill-payments.e2e-spec.ts`; add `provider-bill.schedule.spec.ts`; `accountant.e2e-spec.ts` must
stay green unchanged. Update the spec in the same PR if a decision changes.
