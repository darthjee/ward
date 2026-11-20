## Description

Sub-issue of epic [#119 — Refactor providers](https://github.com/darthjee/ward/issues/119).
The **contract** step: remove the provider-level schedule and every transition shim now that the
frontend uses provider bills. Builds against `docs/agents/specs/split-provider/migration.md`.
Must ship only after the frontend sub-issues ([#124](https://github.com/darthjee/ward/issues/124),
[#131](https://github.com/darthjee/ward/issues/131), [#132](https://github.com/darthjee/ward/issues/132),
[#133](https://github.com/darthjee/ward/issues/133)) are **deployed** — merged is not enough. Planning
and implementation may proceed before that; only the merge is gated.

## Problem

During the transition the provider still stores a schedule (`expected_amount`,
`charge_frequency`, `due_day`, `due_month`, `bills_from`, `show_in_calendar`,
`paying_account_id` in `bank_provider_expense_details`), kept in sync by write-through, and the
backend serves compatibility aliases and the legacy `'provider'` occurrence kind. Leaving them
would keep two sources of truth.

## Expected Behavior

- Migration drops the seven schedule columns from `bank_provider_expense_details`;
  `for_accountant` and `provider_tax_id` stay. Its `down` re-adds them and backfills from the
  provider's single recurring bill (`NULL` with zero or several) — lossy, and documented as such.
- Provider-expense DTOs / response no longer carry schedule fields; sending one → `400`.
- Write-through and `409 PROVIDER_HAS_MULTIPLE_BILLS` removed.
- Compatibility aliases removed: account-level occurrence payment and `bill-payments.json` serve
  `debt` accounts only; a `provider_expense` account → `404`.
- `account-schedule.validator.ts` no longer runs for `provider_expense`; `WithPayingAccount`
  leaves the provider handler (`account-types/schedule-fields.ts`); the `provider` branch of
  `billSourceOf` is deleted.
- `OccurrenceKind` becomes `'debt' | 'provider_bill' | 'bill'` (recurring provider-bill
  occurrences, built by `billSourceOfProviderBill`, now carry `provider_bill`); `BillSource.kind`
  and the `kind === 'provider'` branches in `bill-payment.service.ts` follow the rename.
- Calendar, payments, history, balances and the accountant hand-off otherwise unchanged.
- The proxy cache is reset on deploy (migrations send no cache-invalidation header).

## Edge Cases

- **`down` backfill source:** only **non-archived recurring** bills count; one-off bills are
  ignored. Exactly one such bill → backfill from it; zero or several → `NULL`.
- **Stale clients sending schedule fields:** a schedule field nested in the `provider_expense`
  object (e.g. `provider_expense.due_day`) must be rejected with `400`, not silently stripped —
  the nested DTO has to be validated strictly too.
- **Debts are untouched:** debt schedule fields, `account-schedule.validator` for debts, and the
  account-level occurrence payment / `bill-payments.json` routes for debts keep working.
- **`OccurrenceKind` rename needs no data migration:** the kind is computed, not persisted. Cached
  calendar responses still carrying `kind: 'provider'` are cleared by the proxy cache reset on
  deploy.
- **Existing payments:** already attached to provider bills by #121/#123 — nothing to repoint;
  payment counts are unchanged by `up`.
- **Rollout window:** the migration runs at boot of the new instance while the old one may still
  serve requests that read the dropped columns, causing a brief window of `500`s on provider
  routes. Accepted (single-user app); no two-step deploy.

## Data Sensitivity & Ownership

- **No new exposure:** the change only removes fields and routes. The removed alias routes answer
  with the **same uniform `404`** the owner-scoped resolver gives for unknown / foreign accounts
  (no distinct status that would reveal a provider account exists); the e2e spec asserts the
  provider `404` is indistinguishable from the foreign-account one.
- **`up` destroys no real data:** since #123 the bills are the source of truth and the seven columns
  are copies. The dry run records the count of providers whose columns disagree with their single
  recurring bill (expected `0`); any non-zero count is explained in the PR before merge.
- **`down` is lossy only for the copies** (`NULL` with zero or several recurring bills); bill data
  is never lost. Running `down` in production is the maintainer's call only.
- **Production dump handling:** the dump contains personal financial data. It stays on the
  maintainer's machine — never committed, attached to the PR, uploaded to CI or shared with
  agents — and is deleted after the dry run. The PR records **aggregate counts only**, never
  provider names, amounts or tax IDs.

## Performance & Security

- **Cheap DDL:** `bank_provider_expense_details` holds one row per provider, so dropping columns
  (instant or table-rebuild on MySQL) takes milliseconds; no special locking strategy.
- **Atomic DDL (MySQL DDL is non-transactional):** `up` drops all seven columns in a **single
  `ALTER TABLE`**; `down` re-adds them in a single `ALTER TABLE` followed by one `UPDATE … JOIN`
  backfill. The migration spec covers re-running `down` after a partial failure, or the issue's PR
  documents that it is not re-runnable.
- **Fewer writes:** removing the write-through means bill create / update / delete no longer touch
  the provider row. No hot read path uses the dropped columns (`calendar.query.ts` doesn't), so
  reads are unaffected.
- **Smaller attack surface:** each provider account loses the account-level occurrence payment
  and `bill-payments.json` routes; probing is covered by the uniform `404` (see Data Sensitivity).
- **Strict nested validation:** `provider_expense.due_day` → `400` (see Edge Cases).
- **Error code removed completely:** `PROVIDER_HAS_MULTIPLE_BILLS` disappears from
  `core/error-codes.ts`, `bank/provider-bill-conflicts.ts` and the provider handler; the frontend
  never mapped it. No dedicated security review beyond the usual PR checks.

## Backward Compatibility

The only consumer of the affected API is Ward's own frontend (Navi warms no bank routes; the
proxy has no rules for them).

| Contract change | Who could hit it | Handling |
|---|---|---|
| Seven schedule fields leave the provider-expense response | **Add charge** prefill | Fixed in the same PR (single-bill prefill) |
| Sending a schedule field → `400` | `TypedAccountsClient` | Allowlist trimmed in the same PR |
| Account-level occurrence payment / `bill-payments.json` → `404` for providers | Nothing (frontend uses per-bill routes since #124/#132) | Uniform `404` |
| `OccurrenceKind` `provider` → `provider_bill` | Calendar `CHARGE_KINDS` (already accepts `provider_bill`) | `provider` entry removed in the same PR; proxy cache reset on deploy |
| `409 PROVIDER_HAS_MULTIPLE_BILLS` removed | Nothing maps it | — |

- **Stale browser tabs:** an open tab with the pre-#125 bundle only loses the **Add charge**
  amount prefill until reload. Accepted (single-user app); no version check or forced reload.
- **No API versioning / deprecation period:** the sole consumer ships in the same PR.
- **Rollback order:** run the migration's `down` **first**, then revert the code — the old code
  reads the dropped columns. The PR description states this.
- **Caching:** nothing to remove from Navi and no proxy rule changes; the proxy cache reset on
  deploy is the only caching step.

## Scope

**In scope** (backend + frontend, one PR):

- Contract migration: drop the seven schedule columns, lossy `down` backfilling from the single
  recurring bill.
- Drop the schedule fields from the provider-expense DTOs / response (`400` when sent).
- Remove the write-through and `409 PROVIDER_HAS_MULTIPLE_BILLS` (including its entry in
  `core/error-codes.ts`).
- Remove the compatibility aliases (account-level occurrence payment and `bill-payments.json`
  → `404` for `provider_expense`).
- Drop `account-schedule.validator` for providers, `WithPayingAccount` from the provider handler,
  and the `provider` branch of `billSourceOf`.
- Rename `OccurrenceKind` `provider` → `provider_bill`.
- Frontend leftovers (see below).
- Update the split-provider spec in the same PR if a decision changes.

**Out of scope:**

- Folding the specs into permanent docs — that is
  [#126](https://github.com/darthjee/ward/issues/126), which follows this issue.
- Behavior changes to provider bills (CRUD, calendar, payments, history, accountant hand-off).
- A data fix-up for providers with zero or several bills — bills are already the source of truth.
- Running the production-dump dry run: the maintainer runs it and records the results in the PR.

## Frontend Leftovers

Two frontend spots still depend on the provider-level schedule fields; they are fixed in the same
PR (the frontend change only removes dependencies, so shipping it together with the backend is
safe). Any further leftover found during implementation is also removed in this PR.

- `frontend/assets/js/client/TypedAccountsClient.js`: `PROVIDER_EXPENSE_FIELDS` shrinks to
  `for_accountant` and `provider_tax_id`, so the nested `provider_expense` body can never carry a
  schedule field (which would now be `400`).
- `frontend/assets/js/components/resources/bank/providers/common/shortcutPresets.js`: the
  **Add charge** shortcut on the provider detail page no longer reads
  `provider_expense.expected_amount`. Its amount is prefilled from the provider's single
  **non-archived recurring** bill (from the bills the detail page already loads) and left empty
  with zero or several — the same rule as the migration's `down`.
- `frontend/assets/js/client/CalendarClient.js`: `CHARGE_KINDS` drops the transitional
  `'provider'` entry (its comment says "`provider` stays until #125"), leaving
  `['provider_bill', 'bill']`; `PayForm` keeps offering **record charge** for provider-bill
  occurrences through the new kind.

Not leftovers: the rest of the calendar (routes provider payments via `source_bill`), `formatExpected` in `providerLabels.js` (fed per-bill fields), and the account-level
`BillsClient` routes (debts only).

## Solution

Backend owned by the `backend` agent; the frontend leftovers by the `frontend` agent. Migration test in the repo convention
(`backend/src/database/tests/bank-*-migration.spec.ts` plus the schema integration spec);
dry-run against a production-shaped dump before merge. Extend
`provider-expense-accounts.e2e-spec.ts` (schedule fields absent; sending one is `400`;
`for_accountant` / `provider_tax_id` round-trip; a nested `provider_expense.due_day` is `400`; debt
schedule fields unaffected), `bill-payments.e2e-spec.ts` (account-level
route `404` for providers), and the calendar unit specs for the new kind. The migration spec asserts the `down` backfill rule
(non-archived recurring bills only) and unchanged payment counts. Frontend Jasmine specs cover the trimmed
`PROVIDER_EXPENSE_FIELDS`, `CHARGE_KINDS` without `'provider'` (record charge still offered for
`provider_bill`), and the **Add charge** prefill (one recurring bill → its amount; zero,
several or only archived → empty). Update the spec in the same PR if a decision changes.
