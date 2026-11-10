# Schedule fields: migration, entities and state

Add `bills_from`, `show_in_calendar` and `paying_account_id` to `bank_debt_details` and `bank_provider_expense_details`. They go in **their own migration**, after `20261108120021-bank-add-transactions-sent-to-accountant-at`, with the `bills_from` backfill. Then carry the fields through the pure state helpers.

## Migration

Add `20261108120022-bank-add-schedule-fields.ts` (class `BankAddScheduleFields20261108120022`). For each of the two tables:

- **Columns:**
  - `bills_from DATE NULL`;
  - `show_in_calendar BOOLEAN NOT NULL DEFAULT true`;
  - `paying_account_id` (same type as `bank_accounts.id`), `NULL`.
- **Foreign key:** `fk_<table>_paying_account` → `bank_accounts.id`, `ON DELETE SET NULL`.
- **Backfill:** `UPDATE <table> SET bills_from = CURRENT_DATE WHERE due_day IS NOT NULL`. Use UTC date semantics, consistent with `todayUtc`. Use `UTC_DATE()` if the session time zone is not guaranteed to be UTC.
- **`down`:** drops the FK and the three columns.

## Entities

Add `billsFrom: string | null` (`type: 'date'`), `showInCalendar: boolean` and `payingAccountId: number | null` to:

- `bank/entities/debt-details.entity.ts`;
- `bank/entities/provider-expense-details.entity.ts`.

## State helpers

In `bank/account-types/debt-details.ts` and `provider-expense-details.ts`:

- Extend `DebtState` / `ProviderExpenseState`, `defaultXState()` (`showInCalendar: true`, the others `null`), `xStateOf()` and `COPIED_FIELDS` (`bills_from` and `show_in_calendar`).
- **`bills_from` lifecycle rule** in `mergeXState`, which now takes a `today` (`YYYY-MM-DD`) argument. When `base.dueDay` is `null`, the merged `dueDay` is non-null, `base.billsFrom` is `null` and the body did not send `bills_from`, set `billsFrom = today`. A cleared `dueDay` keeps `billsFrom`. Callers pass `todayUtc(new Date())`.
- **Size limit.** If this pushes a file over 300 lines or complexity 10, extract a shared `account-types/schedule-fields.ts` used by both helpers.

## DTOs

In `bank/dto/debt-details.dto.ts` and `provider-expense-details.dto.ts`:

- `bills_from`: `@IsOptional() @IsCalendarDate()` (null allowed);
- `show_in_calendar`: `@IsOptionalNonNull() @IsBoolean()`;
- `paying_account_id`: `@IsOptional()` plus a positive integer (null clears it).

## Tests

- **Migration unit spec:** `database/tests/bank-add-schedule-fields-migration.spec.ts`, using `fakeQueryRunner`. It asserts the columns, the FK, the backfill query and `down`.
- **Integration specs:**
  - append the migration to `MIGRATIONS` in `test-data-source.ts`;
  - extend `bank-schema.integration-spec.ts` with the columns, the default and the FK;
  - add a backfill check: rows with `due_day` set get today, the others stay NULL.
- **State-helper specs:** `show_in_calendar` defaults to `true`; `bills_from` is set to today when `due_day` is first set and kept when `due_day` is cleared; an explicitly sent `bills_from` wins.

## Files to Change

- `backend/src/database/migrations/20261108120022-bank-add-schedule-fields.ts` — new migration with the backfill
- `backend/src/database/tests/bank-add-schedule-fields-migration.spec.ts` — new unit spec
- `backend/src/database/tests/integration/test-data-source.ts` — register the migration
- `backend/src/database/tests/integration/bank-schema.integration-spec.ts` — the new columns and FKs
- `backend/src/bank/entities/debt-details.entity.ts`, `provider-expense-details.entity.ts` — the new columns
- `backend/src/bank/account-types/debt-details.ts`, `provider-expense-details.ts` (and maybe a new `schedule-fields.ts`) — state, merge with `today`, and the `bills_from` lifecycle
- `backend/src/bank/dto/debt-details.dto.ts`, `provider-expense-details.dto.ts` — the optional fields
- `backend/src/bank/tests/*debt*`, `*provider*` specs — the lifecycle and default tests
