# Contract migration and entity

Add the migration `backend/src/database/migrations/20261120120026-bank-contract-provider-bills.ts`
(class `BankContractProviderBills20261120120026`). Follow the expand migration's conventions:

- raw `queryRunner.query`;
- SQL exported as `const`s so the spec can assert on it;
- `information_schema` existence checks rather than `getTable`, which breaks with generated
  columns.

## `up`

Run a single `ALTER TABLE bank_provider_expense_details` that:

- drops the foreign key `fk_bank_provider_expense_details_paying_account`;
- drops the seven columns `expected_amount`, `charge_frequency`, `due_day`, `due_month`,
  `bills_from`, `show_in_calendar` and `paying_account_id`.

The step is skipped when the columns are already gone, so a partial or repeated run is safe. Keep
`for_accountant`, `provider_tax_id` and the timestamps.

## `down`

`down` is lossy, and the file documents this in its JSDoc.

1. Run a single `ALTER TABLE` that re-adds the seven columns with their original definitions:
   - `expected_amount BIGINT NULL`
   - `charge_frequency VARCHAR(16) NOT NULL DEFAULT 'monthly'`
   - `due_day TINYINT NULL`
   - `due_month TINYINT NULL`
   - `bills_from DATE NULL`
   - `show_in_calendar TINYINT(1) NOT NULL DEFAULT 1`
   - `paying_account_id INT NULL`, plus the FK `ON DELETE SET NULL`

   Copy the exact definitions from `20261108120022-bank-add-schedule-fields.ts`. Skip any column
   or FK that already exists, so `down` can be re-run after a partial failure.
2. Run one `UPDATE … JOIN` that backfills from a derived table: for each provider, the
   `kind = 'recurring'` bills `HAVING COUNT(*) = 1`.
   - One-off bills are ignored.
   - Providers with zero or several recurring bills keep `NULL` and the column defaults.
   - Use `COALESCE` for `charge_frequency` (`'monthly'`) and `show_in_calendar` (`1`), because
     bill columns are nullable while the details columns are `NOT NULL`.
   - The `UPDATE` is idempotent.

## Entity and registry

- Remove the seven columns from `backend/src/bank/entities/provider-expense-details.entity.ts`.
  Move the `ProviderChargeFrequency` type to `provider-bill.entity.ts`, or another bill module,
  and update its importers (`create-provider-bill.dto.ts`, `update-provider-bill.dto.ts`).
- Register the migration in `backend/src/database/tests/integration/test-data-source.ts`, both
  the import and the `MIGRATIONS` array. `migrations-registry.integration-spec.ts` enforces this.

## Tests

- New `backend/src/database/tests/bank-contract-provider-bills-migration.spec.ts`, using
  `fakeQueryRunner()`. It asserts:
  - the single `ALTER` in `up`, which includes the FK drop;
  - `up` is skipped when the columns are absent;
  - `down` issues one `ALTER`, then the backfill `UPDATE`;
  - `down` skips columns and the FK that already exist (re-run after partial failure).
- `backend/src/database/tests/integration/bank-schema.integration-spec.ts`:
  - `SCHEDULE_TABLES` and the "schedule fields" block become debt-only;
  - assert the seven columns are absent from `bank_provider_expense_details` after a full run;
  - fix `insertProviderExpenseDetails` and the column assertions around L283-300;
  - add one `undoLastMigration()` to the down-chain test and fix its stale comment;
  - add a contract `down` test, which runs against real MySQL:
    - a provider with exactly one recurring bill (plus one-off bills) gets its values back;
    - providers with zero or two recurring bills get `NULL`;
    - running `down` twice is safe;
    - the `bank_bill_payments` count is unchanged by `up`.
- Fix `backend/src/database/tests/integration/bills-calendar.integration-spec.ts` around L93,
  which saves `ProviderExpenseDetails` with `dueDay` / `billsFrom`.
- Run `migrations-round-trip.integration-spec.ts`. It should pass as is; add a column assertion
  for the provider details table.

## Files to Change

- `backend/src/database/migrations/20261120120026-bank-contract-provider-bills.ts`: new
  migration.
- `backend/src/bank/entities/provider-expense-details.entity.ts`: drop the seven columns and
  move `ProviderChargeFrequency` out.
- `backend/src/bank/entities/provider-bill.entity.ts`: receives `ProviderChargeFrequency`, if
  moved there.
- `backend/src/bank/dto/create-provider-bill.dto.ts` and
  `backend/src/bank/dto/update-provider-bill.dto.ts`: update the type import.
- `backend/src/database/tests/integration/test-data-source.ts`: register the migration.
- `backend/src/database/tests/bank-contract-provider-bills-migration.spec.ts`: new unit spec.
- `backend/src/database/tests/integration/bank-schema.integration-spec.ts`: schema assertions and
  the `down` backfill test.
- `backend/src/database/tests/integration/bills-calendar.integration-spec.ts`: drop the removed
  entity fields.
- `backend/src/database/tests/integration/migrations-round-trip.integration-spec.ts`: optional
  column assertion.
