## Description

Sub-issue of epic [#119 — Refactor providers](https://github.com/darthjee/ward/issues/119).
Add the `provider-bills` CRUD API so a `provider_expense` account can hold several recurring and
one-off bills. Builds against `docs/agents/specs/split-provider/api/provider-bills.md` and
`model.md`. Requires the expand migration (`bank_provider_bills` with `kind`).

## Problem

After the expand migration the table supports N bills per provider, but the only write paths are
the legacy `bills.json` (one-off only) and the provider schedule write-through (a single
recurring bill). There is no way to create, list, edit or delete individual provider bills.

## Expected Behavior

```text
GET    <base>/accounts/:accountId/provider-bills.json?kind=&page=
POST   <base>/accounts/:accountId/provider-bills.json
GET    <base>/provider-bills/:id.json
PATCH  <base>/provider-bills/:id.json
DELETE <base>/provider-bills/:id.json
```

for both `<base>` = `/bank` and `/orgs/:orgId/bank`.

- **List** — `:accountId` must be an owned `provider_expense` account (archived included);
  paginated 50 per page; recurring bills first by `description`, then one-offs by newest
  `due_date`; unknown `kind` → empty list.
- **Create** — under an archived provider → `409 ACCOUNT_ARCHIVED`. `recurring`: requires
  `charge_frequency` (default `monthly`), `due_day`, `bills_from` (default UTC today),
  `show_in_calendar` (default `true`), `due_month` only when `yearly`, `due_date` null,
  `expected_amount` optional. `one_off`: requires `due_date` and `expected_amount` (> 0), the
  recurring group null. Fields of the other kind → `400`, checked on the merged state.
- **Read / update / delete** — `ProviderBillResolver` loads the bill and its provider owner-scoped
  (`accountOwnerWhere`, `type = provider_expense`, not archived); unknown, foreign,
  other-context, archived-provider and debt ids → the same `404`.
- **Conflicts** — `kind` change → `409 PROVIDER_BILL_KIND_LOCKED`; provider change on a recurring
  bill → `409 PROVIDER_BILL_PROVIDER_LOCKED` (one-offs move unless paid, as today); duplicate
  recurring description in one provider (case- and accent-insensitive, matching the DB collation) →
  `409 PROVIDER_BILL_NAME_TAKEN`; 51st recurring bill → `409 PROVIDER_BILL_LIMIT`; delete with a
  `paid` payment row → `409 PROVIDER_BILL_PAID` (skipped rows cascade).
- `paying_account_id` resolved through `PayingAccountResolver` (generic `422`
  `ACCOUNT_NOT_FOUND` / `CURRENCY_MISMATCH`).
- Provider currency change (only before any transaction) rescales every bill's
  `expected_amount`; an unrepresentable amount → `400` for the whole PATCH.
- Each route declares its `@CachePolicy` as decided in the spec (GETs `user-scoped` with
  `X-Cache-Allow`; writes `never` with `X-Skip-Cache` and `InvalidatesOwner()`). Navi warms none
  of them, so nothing under `navi/` changes.
- Calendar, payments and history are **not** changed here.

## Scope

**In scope**

- The five `provider-bills` routes on both bases, with the validation and `409` rules above.
- **`409 PROVIDER_HAS_MULTIPLE_BILLS`** (transition rule, `migration.md`): once a provider holds
  two or more recurring bills, a provider-expense `PATCH` sending any schedule field → `409`;
  non-schedule fields (`name`, `for_accountant`, `provider_tax_id`, …) are unaffected. e2e
  covered here.
- Provider currency change rescaling every bill's `expected_amount`.
- `ProviderBillResolver` and the reuse of `bill.service.ts`: the `kind = 'one_off'` filter
  already exists from #121, so this issue only adds the recurring path and `kind`-parameterised
  queries — the `bills.json` contract stays untouched.

**Out of scope**

- Per-bill calendar occurrences, `source_bill`, per-bill payment / history routes, the
  compatibility aliases returning `404`, and details schedule fields becoming `null` with zero or
  several bills — #123.
- Any frontend change — #124.
- Removing the write-through, the `409` and the aliases — #125.
- Archiving an individual provider bill — deferred by the epic.

**Known transitional gap (accepted)**

Between #122 and #123, a provider can hold several recurring bills while the calendar and the
#121 payment writer still assume "the single recurring bill". This is accepted: until #124 ships,
a second recurring bill can only be created by calling the API directly, so no user reaches this
state in practice. No fail-closed guard is added.

The same applies in reverse: until #123 moves reads to the bill, the Calendar and the
provider-expense details response read the schedule from `bank_provider_expense_details`. Editing
the provider's only recurring bill through `/provider-bills` does **not** write back to that
row, so those reads show the old schedule. This is accepted for the same reason, and there is
no reverse write-through.

## Edge cases

- **Write-through gated.** Today `ProviderExpenseAccountHandler.saveDetails` calls
  `syncProviderBill` on every provider-expense create / `PATCH`, whatever fields were sent, and
  overwrites "the" recurring bill (`findOne`) from `bank_provider_expense_details`. From #122 the
  schedule write-through runs **only when the request actually sends a schedule field**
  (`expected_amount`, `charge_frequency`, `due_day`, `due_month`, `bills_from`,
  `show_in_calendar`, `paying_account_id`) **and the provider has at most one recurring bill**.
  Without this, a name-only `PATCH` (allowed with several bills) would overwrite an arbitrary
  recurring bill, and any provider `PATCH` would silently revert edits made through
  `PATCH /provider-bills/:id` on the single recurring bill. Update `migration.md` in the same PR.
- **Description sync narrowed.** The #121 write-through syncs the recurring bill's
  `description` to the account name **only when the provider-expense `PATCH` actually changes
  `name`**, and only while the provider has exactly one recurring bill. A schedule-only `PATCH`
  no longer overwrites a description set through `PATCH /provider-bills/:id`. With zero or
  several recurring bills, nothing is synced. This revises `migration.md` ("The write-through
  also syncs the bill `description` to the account name"), so update the spec in the same PR.
- **Moving a one-off to another provider.** The target is resolved owner-scoped: an unknown or
  foreign target → the uniform `404`; an archived target → `409 ACCOUNT_ARCHIVED` (same as
  create); a target with a different currency → `422 CURRENCY_MISMATCH` (`expected_amount` is in
  the provider's minor units, so it is never rescaled on a move); a paid one-off →
  `409 PROVIDER_BILL_PAID`. `paying_account_id` is re-checked through `PayingAccountResolver`
  against the target.
- **Races on recurring constraints.** A recurring create, and a rename of a recurring bill,
  lock the provider row `FOR UPDATE` before counting, so the 50-bill cap cannot be exceeded under
  concurrency. Name uniqueness also relies on the existing
  `UNIQUE (provider_account_id, recurring_description)`, with `ER_DUP_ENTRY` mapped to
  `409 PROVIDER_BILL_NAME_TAKEN`, never a raw `500`.
- **Name comparison follows the DB collation.** The unique key uses the table's default
  collation (`utf8mb4_0900_ai_ci`, no explicit `COLLATE`), so `"Água"` and `"agua"` collide.
  The application-side check compares the same way (case- and accent-insensitive), and the spec
  documents `PROVIDER_BILL_NAME_TAKEN` as such.
- **Schedule edit on a bill with paid payments** is allowed, as with today's provider schedule
  edits. Payments keep their nominal `due_date` and show as `off_schedule` in history (#123).
  No new error code.
- **Deleting the provider's only recurring bill.** A later provider-expense `PATCH` that sets
  `due_day` re-creates it through the write-through ("created when `due_day` is first set").
  A `PATCH` that sends no schedule field (e.g. name-only) does **not** re-create it, even though
  the details row still holds a `due_day`.

## Backward compatibility

- **`bills.json` keeps its contract.** All five routes (`GET/POST bills.json`,
  `GET/PATCH/DELETE bills/:id.json`) stay one-off only, use `amount`, and return `404` for a
  recurring id. One-offs created through either path are visible through both, because they are
  the same entity.
- **Deliberate change on `PATCH bills/:id.json`.** Both paths share one service, so the new
  one-off move rules apply there too: a target with a different currency →
  `422 CURRENCY_MISMATCH`, and an archived target → `409 ACCOUNT_ARCHIVED`. The error body shape
  is unchanged. Record this as an intended correctness fix in the spec.
- **Shipped frontend.** It calls no `provider-bills` route. `PROVIDER_HAS_MULTIPLE_BILLS` can
  only fire after a second recurring bill was created through the API directly, so the current UI
  never sees it.
- **Existing providers** keep exactly the single recurring bill backfilled by #121. Their
  behavior is unchanged until someone uses the new routes.

## Testing strategy

The specs' Required tests sections (`api/provider-bills.md`, `security.md`, `model.md`), plus
the decisions above:

- **`provider-bill-dtos.spec.ts`** (new): every `400` on create and on merged `PATCH` (fields of
  the other group, `due_month` pairing, `expected_amount > 0`, non-whitelisted fields). A `kind`
  change is `409`.
- **`provider-bill.resolver.spec.ts`** (new): the uniform `404` (unknown, foreign, other
  context, archived provider, debt id), with identical bodies.
- **`provider-bills.e2e-spec.ts`** (new, in-memory repos):
  - full CRUD on both bases, with pagination, ordering and the `kind` / `page` filters;
  - the `404` matrix, plus cross-owner and cross-org denial on every verb;
  - `ACCOUNT_ARCHIVED` and the sequential `NAME_TAKEN` (case- and accent-insensitive; one-offs may repeat),
    `KIND_LOCKED`, `PROVIDER_LOCKED` (checked before target resolution), `PAID` and `LIMIT`
    conflicts;
  - the one-off move rules (`422 CURRENCY_MISMATCH`, `409 ACCOUNT_ARCHIVED`,
    `409 PROVIDER_BILL_PAID`, paying account re-checked against the target);
  - a schedule edit on a recurring bill with paid payments succeeds;
  - `422` from `PayingAccountResolver`;
  - cache headers (`X-Cache-Allow` on GETs, `X-Skip-Cache` and owner invalidation on writes).
  - The in-memory repo emulates the case- and accent-insensitive recurring-description uniqueness.
- **`bills.e2e-spec.ts`** (extend): only `one_off` is listed, creating sets
  `kind = 'one_off'`, and a recurring field is `400`. `PATCH bills/:id.json` follows the new move
  rules (`422` / `409`).
- **`provider-expense-accounts.e2e-spec.ts`** (extend):
  - `409 PROVIDER_HAS_MULTIPLE_BILLS` on a schedule field with two or more recurring bills,
    while non-schedule fields still pass;
  - the description sync runs only when `name` changes and only with exactly one recurring
    bill;
  - setting `due_day` after deleting the only recurring bill re-creates it, while a name-only
    `PATCH` does not;
  - the write-through is skipped when no schedule field is sent: a name-only / `for_accountant`
    `PATCH` leaves a recurring bill edited through `/provider-bills` untouched;
  - with two or more recurring bills, a name-only `PATCH` touches none of them;
  - a currency change rescales every bill (both kinds), and an unrepresentable amount → `400`
    with nothing persisted.
- **`database/tests/integration/provider-bills.integration-spec.ts`** (new, real MySQL):
  - concurrent recurring creates on a provider at 49 bills → one success and one
    `409 PROVIDER_BILL_LIMIT`;
  - concurrent creates with the same description in different case / accents → one
    `409 PROVIDER_BILL_NAME_TAKEN`, never a `500` (`ER_DUP_ENTRY` mapped);
  - `DELETE` cascades skipped payment rows.

## Solution

Owned by the `backend` agent; the `cache` agent only reviews the `@CachePolicy` declarations
(no `navi/` change). Reuse
`bill.service.ts` with a `kind` filter rather than duplicating it; add
`provider-bills.controller.ts` and `provider-bill.resolver.ts` (the bill-id counterpart of
`bill-source.resolver.ts`). Tests: `provider-bill-dtos.spec.ts` (every `400` on create and
merged PATCH; `kind` change is `409`), `provider-bill.resolver.spec.ts` (uniform `404` matrix),
`provider-bills.e2e-spec.ts` (full CRUD on both base paths, every conflict, pagination and
ordering). Update the spec in the same PR if a decision changes.
