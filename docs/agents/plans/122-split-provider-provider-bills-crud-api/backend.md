# Plan: Split provider — provider-bills CRUD API

Issue: [122-split-provider-provider-bills-crud-api.md](../../issues/122-split-provider-provider-bills-crud-api.md)

## Overview

Implement the `provider-bills` CRUD on both base paths, reusing the existing bill code with a
`kind` parameter rather than duplicating it.

Then make the provider-expense write-through safe for N bills:

- gate it;
- add `409 PROVIDER_HAS_MULTIPLE_BILLS`;
- narrow the description sync;
- rescale every bill on a provider currency change.

`bills.json` keeps its contract apart from the deliberate move-rule fixes.

## Context

- The expand migration (#121) already created `bank_provider_bills`:
  - entity `ProviderBill` in `backend/src/bank/entities/provider-bill.entity.ts`;
  - `kind` `recurring | one_off`;
  - the VIRTUAL `recurring_description` with
    `UNIQUE uq_bank_provider_bills_recurring_description (provider_account_id, recurring_description)`,
    using the default collation `utf8mb4_0900_ai_ci` (case- and accent-insensitive).
- Payments use `bank_bill_payments`: `bill_id` for one-offs, `provider_bill_id` for recurring bills.
  Both FKs are `ON DELETE CASCADE`, so a delete must check for `paid` rows first.
- `BillService` (`backend/src/bank/bill.service.ts`, 288 lines) hardcodes `kind: 'one_off'` in
  `list`, `findOwned` and `#lockedBill`. `findOwned` is also used by `bill-payment.service.ts`.
- Two files sit at the 300-line `max-lines` cap: `account.service.ts` (299 lines) and
  `bill.service.ts` (288 lines). New logic goes into **new files**.
- Every bank controller uses `@OwnerScopedController('bank')`. It registers both bases, makes
  `user-scoped` the default and adds `InvalidatesOwner()`. Writes add
  `@CachePolicy(CacheClass.Never)`. `core/tests/cache-policy.coverage.spec.ts` enforces this.

### Decisions taken for this plan (gaps in the issue/spec)

1. **Wire format of `expected_amount`.** It is a decimal string, both in requests (parsed with
   `parseAmountInput` / `parseExpectedAmount` against the provider currency) and in responses
   (`formatAmount`), like every other amount in the API. It is stored as bigint minor units.
2. **Response shape:**
   - Fields: `id`, `provider_account_id`, `kind`, `description`, `paying_account_id`,
     `expected_amount`, `notes`, `charge_frequency`, `due_day`, `due_month`, `bills_from`,
     `show_in_calendar`, `due_date`, `created_at`, `updated_at`.
   - Use an explicit mapper, never an entity spread.
   - The list response is `{ provider_bills: [...], pagination }`, with `pagination` from
     `buildPagination`.
3. **`bills.json` response** gains `kind: 'one_off'`. This is additive and matches
   `api/provider-bills.md`. Nothing else in the shape changes.
4. **Error codes for paid bills.** `bills.json` keeps `BILL_PAID`. `provider-bills` uses
   `PROVIDER_BILL_PAID`. The shared code takes the conflict factory as a parameter.
5. **One-off move target, shared by both paths.**

   | Target | `provider-bills` | `bills.json` |
   |---|---|---|
   | Unknown or foreign | Uniform `404` | Keeps today's `422 ACCOUNT_NOT_FOUND` (not listed as a change in the issue) |
   | Archived | `409 ACCOUNT_ARCHIVED` | `409 ACCOUNT_ARCHIVED` |
   | Different currency | `422 CURRENCY_MISMATCH` (no rescale anymore) | `422 CURRENCY_MISMATCH` (no rescale anymore) |
   | Paid one-off | `409 PROVIDER_BILL_PAID` | `409 BILL_PAID` |

   On every move, `paying_account_id` is re-checked through `PayingAccountResolver` against the
   target. `POST bills.json` keeps its current `422` for an unknown or archived body provider.
6. **Nested `:accountId`.** Resolve it owner-scoped with `type = provider_expense`, archived
   allowed for the list. A debt account, an unknown account or a foreign account gives the uniform
   `404`. Do not use `BillSourceResolver` as is, because it accepts debt accounts.
7. **Paying accounts on a currency change.** When the provider currency changes, every bill with a
   `paying_account_id` is re-checked through `PayingAccountResolver` against the new currency. A
   mismatch gives `422 CURRENCY_MISMATCH` and the whole PATCH is rejected. This mirrors today's
   provider-level re-check in `AccountScheduleValidator`.
8. **Description comparison.** Recurring bills are capped at 50, so the application-side check
   loads the provider's recurring descriptions and compares them in JS with a shared
   `sameDescription(a, b)` helper: `a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0`
   after trimming. The DB unique key is the final guard: `ER_DUP_ENTRY` maps to
   `409 PROVIDER_BILL_NAME_TAKEN`.
9. **Locks.**
   - A recurring create and a recurring rename lock the provider account row (`pessimistic_write`
     on `Account`) inside the transaction before counting.
   - The write-through gate and the `PROVIDER_HAS_MULTIPLE_BILLS` check take the same lock.
   - Update and delete lock the bill row.

## Steps

- [01 — Error codes, conflicts and DTOs](backend/01-error-codes-conflicts-dtos.md)
- [02 — Owner-scoped resolvers](backend/02-resolvers.md)
- [03 — Provider-bill service and shared bill logic](backend/03-provider-bill-service.md)
- [04 — Controller, module wiring and e2e](backend/04-controller-wiring-e2e.md)
- [05 — bills.json compatibility changes](backend/05-bills-json-compat.md)
- [06 — Provider-expense write-through gating, multiple-bills 409 and currency rescale](backend/06-provider-expense-transition.md)
- [07 — MySQL integration spec](backend/07-integration-spec.md)

## CI Checks

- `backend`:
  - Lint: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`).
  - Unit and e2e: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`).
  - Integration: `docker-compose run --rm ward_tests yarn test:integration` (CI job:
    `backend_integration`).
  - Build: `docker-compose run --rm ward_tests yarn build` (CI job: `backend_build`).

## Notes

- Keep every file under the 300-line `max-lines` cap. `account.service.ts` (299 lines) cannot take
  new code: extract a helper if the previous name or currency must be captured there.
- `mapNameClash` in `AccountService.#saveWithDetails` maps **any** `ER_DUP_ENTRY` to
  `ACCOUNT_NAME_TAKEN`. The description sync only runs with exactly one recurring bill, so it
  cannot collide. Still, do not let a provider-bill `ER_DUP_ENTRY` raised inside that transaction
  go out with the wrong code.
- **Known gap, out of scope (payments are #123).** Recurring payments
  (`bill-payment.writer.ts`) do not lock the recurring bill. A pay that lands after a delete may
  hit an FK error. Flag it in the PR.
- Ordering of checks: every `409` comes only after the owner-scoped resolve succeeds.
  `PROVIDER_BILL_PROVIDER_LOCKED` is checked **before** any target-provider resolution.
- Calendar, payments, history and the details read path are unchanged. The transitional gaps
  listed in the issue are accepted.
- Do not edit anything under `docs/agents/`. The architect applies the spec updates listed in
  [plan.md](plan.md).
