# Backend Plan: Implement bills and the calendar — backend

Main plan: [plan.md](plan.md)

## Overview

Implement `docs/agents/specs/banking/bills.md` in the lazy `bank` module, with the decisions of issue #56:

- **Schedule fields** on the debt / provider-expense details: `bills_from`, `show_in_calendar` and `paying_account_id`.
- **Tables:** `bank_bills` and `bank_bill_payments`.
- **Occurrence generator:** a pure function.
- **Routes:**
  - `calendar.json` / `calendar/overdue.json`, computed from three queries;
  - one-off bill CRUD;
  - pay / skip / undo for derived occurrences and one-off bills, written atomically with their ledger transactions;
  - `accounts/:accountId/bill-payments.json`.

No worker, cron or scheduled job is added. No new Nest module is added either: everything loads with `BankModule`.

## Context

Facts from exploring `backend/src/` that shape the design:

- **Two bank modules.**
  - `bank/bank-routes.module.ts` (resident) holds the controllers.
  - `bank/bank.module.ts` (lazy) holds the services and queries.
  - Controllers reach the services through `BankModuleLoader.services()` (`bank/bank-module.loader.ts`).
  - New entities go into **both** `forFeature` lists, into `ENTITIES` in `database/tests/integration/test-data-source.ts`, and into the e2e fake data source.
- **Controller conventions.**
  - Controllers use `@OwnerScopedController('bank')`, which mounts both prefixes and makes the class `user-scoped`.
  - Writes add `@CachePolicy(CacheClass.Never)`.
  - Handlers use `@CurrentOwner()`, `parseId()` and `@StrictBody()`. A plain `@Body()` fails the coverage spec.
  - Never set `X-Skip-Cache` by hand.
- **Error helpers.**
  - A path id that does not resolve gets `ownerNotFound()` (404).
  - 409 helpers live in `bank/account-conflicts.ts`.
  - **No 422 helper exists yet**, so this issue adds one.
  - `bank/mysql-errors.ts` maps duplicate-entry errors.
- **Reusable helpers.**
  - Pagination: `bank/pagination.ts` (`LEDGER_PER_PAGE`, `parsePage`, `buildPagination`).
  - Dates: `bank/ledger-date.ts` (`todayUtc`, `isIsoDate`, `isAllowedLedgerDate`). There is no date-arithmetic library.
  - Amounts: `bank/currency.ts` and `bank/amount-input.ts`.
  - DTO validators: `dto/field-validators.ts` (`IsCalendarDate`, `IsLedgerDate`, `DESCRIPTION_MAX_LENGTH`, `NOTES_MAX_LENGTH`).
- **Ledger and hand-off.**
  - Ledger transactions are a signed `amount` with no kind column.
  - A charge is a negative amount on a `provider_expense` account. It feeds the accountant hand-off automatically when `for_accountant = true` and `sent_to_accountant_at` is NULL.
- **Atomic writes.** Atomic writes use `repository.manager.transaction(async manager => …)`. In the e2e harness this call does not roll back, so rollback has to be proven by a unit spec (a fake manager that throws mid-way) and/or a MySQL integration spec.
- **Lint limits.** At most 300 lines per file and complexity 10. `account.service.ts` is already at about 293 lines, so new logic goes into new files.

## Steps

- [01 — Schedule fields: migration, entities and state](backend/01-schedule-fields-migration-and-state.md)
- [02 — Schedule fields: paying-account validation and response](backend/02-schedule-fields-api.md)
- [03 — Bills and bill-payments tables and entities](backend/03-bills-tables-and-entities.md)
- [04 — Pure occurrence generator](backend/04-occurrence-generator.md)
- [05 — Calendar and overdue routes](backend/05-calendar-routes.md)
- [06 — One-off bill CRUD](backend/06-one-off-bill-crud.md)
- [07 — Pay, skip and undo](backend/07-pay-skip-undo.md)
- [08 — Bill history](backend/08-bill-history.md)
- [09 — Docs (architect-owned)](backend/09-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)

## Notes

- **Spec is the source of truth.** Build against `bills.md` and the issue's *Decisions*. If a spec rule turns out to be unclear or wrong, raise it on issue #56; never deviate silently.
- **Partial unique key.** MySQL has no partial unique index. The derived-occurrence key `(source_account_id, due_date) WHERE bill_id IS NULL` is built from a stored generated column `derived_due_date = IF(bill_id IS NULL, due_date, NULL)` plus `UNIQUE (source_account_id, derived_due_date)`. MySQL allows repeated NULLs in a unique key, so one-off rows never collide. `UNIQUE (bill_id)` covers one-offs. Step 03 has the details.
- **Account delete.** The new FKs to `bank_accounts` affect account deletion:
  - `bank_bills.provider_account_id` and `bank_bill_payments.source_account_id` cascade on delete.
  - The paying-account FKs are SET NULL.
  - So `AccountService.delete` is unchanged: its "409 while it has transactions" rule still comes from `bank_transactions` (`RESTRICT`).
- **Step 09 owner.** Step 09 edits `docs/agents/`, which is the **architect's** scope. The coordinator applies it (or explicitly delegates it), in the same PR.
- **Reviews.** After implementation, run the `security`, `data-access` and `cache` reviews. `cache` should confirm that no Navi resource is added and that every GET is `user-scoped` and every write `never`.
- **Description truncation.** Payment descriptions count code points (`@MaxCodePoints`), so truncate to 255 by code points, not by UTF-16 units.
- **Open points to raise on issue #56.** These are not settled by the spec or the issue. Implement the stated default and comment on the issue:
  - **Archived provider in a bill body.** Default: 422 "account not found" (step 06).
  - **Undo for a date no longer on the schedule.** Default: undo resolves the payment row by `(account, due_date)` without the nominal-occurrence check, so off-schedule payments can still be undone; pay keeps the strict 404 (step 07).
  - **Bill history of an archived account.** Default: follow the ledger's read behaviour for archived accounts (step 08).
