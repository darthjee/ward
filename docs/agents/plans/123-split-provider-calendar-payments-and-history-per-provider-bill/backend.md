# Plan: Split provider: calendar, payments and history per provider bill

Issue: [123-split-provider-calendar-payments-and-history-per-provider-bill.md](../../issues/123-split-provider-calendar-payments-and-history-per-provider-bill.md)

## Overview

Make the calendar, overdue, payment writer and history work per `ProviderBill`. Calendar and
overdue get one `BillSchedule` per recurring bill, loaded in one query. Occurrences gain
`source_bill`. New per-bill routes cover pay, undo and history for both kinds. The account-level
pay and undo routes become aliases. The provider-expense details read side follows the single
recurring bill. Existing data must stay byte-identical in the ledger, balances and the accountant
hand-off.

## Context

Current state, as explored. All paths are under `backend/src/bank/`.

- `billSourceOf()` (`bill-schedule.ts`) builds one `BillSource` per provider from the
  `bank_provider_expense_details` row.
- `CalendarQuery.sources()` loads details through `registry.loadDetails`, and
  `CalendarQuery.payments()` matches derived payments by
  `{sourceAccountId IN, billId IS NULL, dueDate}`.
- `CalendarService` keys payments by `${sourceAccountId}:${dueDate}` for every row with
  `billId === null`.
- `BillPayment.providerBillId` and `PaymentTarget.providerBillId` already exist (#121/#122):
  - `#write` already stamps `providerBillId`;
  - `BillPaymentService.#recurringBillId` picks an arbitrary recurring bill;
  - `find()` has only two branches (derived by source account, one-off by `billId`), so two
    bills of one provider on the same date give a false `409`.
- `#recheck` in the writer locks only one-off bills `FOR UPDATE`. Recurring bills get no lock
  and no schedule re-check.
- `ProviderBillResolver.peek` always excludes archived providers. There is no `allowArchived`
  option yet.
- `BillHistoryService.history` pages by `sourceAccountId` and computes `off_schedule` against
  the details-row schedule.
- `ProviderExpenseResponse` has non-nullable `charge_frequency`, and `show_in_calendar` comes from
  `ScheduleResponse`, which is shared with debt.
- MySQL `UNIQUE (provider_bill_id, provider_bill_due_date)` exists (#121).
- The only cap in code is the 366-day range (`dto/calendar-query.dto.ts`). The
  1000-occurrence cap from the spec does not exist yet.

## Steps

- [01 — Per-bill schedule](backend/01-per-bill-schedule.md)
- [02 — Occurrence payload and calendar per bill](backend/02-calendar-per-bill.md)
- [03 — Writer: per-bill lookup, lock and re-check](backend/03-writer-per-bill.md)
- [04 — Per-bill pay and undo routes, account-level aliases](backend/04-pay-undo-routes-and-aliases.md)
- [05 — Per-bill and account-wide history](backend/05-history.md)
- [06 — Provider-expense details read side](backend/06-provider-expense-read-side.md)

## CI Checks

- `backend`:
  - `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
  - `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)
  - `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
  - `docker-compose run --rm ward_tests yarn build` (CI job: `backend_build`)

## Notes

- **Lock order (decision).** Use provider (share) → provider bill (`FOR UPDATE`) → paying account
  (share).
  - The writer inserts rows whose FKs point at the provider. InnoDB takes a shared lock on the
    parent row for those inserts, so locking the bill first would invert against bill `PATCH`
    (provider X → bill X).
  - So the writer explicitly takes `pessimistic_read` on the provider **before** the bill lock.
  - The patch-vs-pay MySQL integration test must prove there is no deadlock.
  - Apply the same order to the legacy one-off path, since it shares the writer.
- **1000-occurrence cap (decision; the spec leaves the answer open).** Count total occurrences
  across all bills and debts after generation.
  - `calendar.json`: over 1000 answers `400 VALIDATION_FAILED`, the same shape as the 366-day
    range error.
  - `overdue.json` has no range parameter, so it is bounded instead: the generator window is
    limited to 366 days back, and the response is cut to the first 1000 after sorting.
  - The architect records this in `security.md` and `api/payments.md`.
- **One-off race.** Under the bill lock, also re-check `due_date` equality for one-offs, on both
  the per-bill route and `bills/:id/payment.json`. That route's observable contract does not
  change.
- **Ledger label.** Recurring provider-bill payments use `bill.description` instead of
  `account.name`, through `paymentDescription()`. Backfilled bills carry the account name, so
  existing flows look identical. `accountant.e2e-spec.ts` pays no bills and must stay unchanged.
- **Orphans.** Rows with `provider_bill_id IS NULL` from a provider source:
  - are left as is, with no migration;
  - are dropped from calendar and overdue, and from per-bill history;
  - still appear in account-level history (`source_bill: null`, `off_schedule` against the
    details row);
  - can no longer be undone through any route. This is accepted, and the docs will mention it.
- **Expected test changes.** In `provider-expense-accounts.e2e-spec.ts`:
  - "hides the bill when due_day is cleared" (~l.162) and the merge/clear case (~l.444–458) now
    show the bill's last `due_day` with `show_in_calendar: false`;
  - the no-N+1 batch test (~l.626) sees one extra recurring-bills batch.
- **Keep files under the size limits.** `bill-payment.service.ts` is already 208 lines, so the
  per-bill logic goes into a new service.
- **Cache classes.**
  - The new GET inherits user-scoped from `@OwnerScopedController`.
  - The new POST and DELETE need `@CachePolicy(CacheClass.Never)` plus owner invalidation.
  - `core/tests/cache-policy.coverage.spec.ts` enforces both.
