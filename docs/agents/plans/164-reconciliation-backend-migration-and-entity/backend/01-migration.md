# Migration
Create `backend/src/database/migrations/<YYYYMMDD>120027-bank-create-reconciliations.ts`, class
`BankCreateReconciliations<YYYYMMDD>120027`. Use the implementation date for `<YYYYMMDD>`. It must sort after
`20261120120026-bank-contract-provider-bills.ts`, the current latest migration.

Follow `model.md` § Migration exactly. Keep the SQL in exported consts, as `20261117120025-bank-expand-provider-bills.ts` does, so the unit spec can assert them.

**`up()`**, in this order:
1. `createTable(new Table({...}), true)` for `bank_reconciliations`, using `idColumn()`, `createdAtColumn()` and `updatedAtColumn()` from `migrations/helpers.ts`:
   - columns: `account_id INT NOT NULL`, `statement_date DATE NOT NULL`, `statement_balance BIGINT NOT NULL`, `reconciled_at DATETIME NULL`;
   - FK `fk_bank_reconciliations_account_id`: `account_id` references `bank_accounts.id` `ON DELETE CASCADE`;
   - index `idx_bank_reconciliations_account_id_statement_date` on `(account_id, statement_date)`.
2. Raw SQL (precedent: `ACCOUNTS_CONSTRAINTS_SQL` in `20261108120016-bank-create-accounts.ts`):
   `ALTER TABLE bank_reconciliations ADD COLUMN open_key INT AS (IF(reconciled_at IS NULL, account_id, NULL)) VIRTUAL, ADD UNIQUE INDEX idx_bank_reconciliations_open_key (open_key)`.
   The column holds an `INT`, so it needs no collation.
3. Raw SQL on `bank_transactions`:
   - `ADD COLUMN reconciliation_id INT NULL`;
   - `ADD INDEX idx_bank_transactions_reconciliation_id (reconciliation_id)`;
   - `ADD CONSTRAINT fk_bank_transactions_reconciliation_id FOREIGN KEY (reconciliation_id) REFERENCES bank_reconciliations(id) ON DELETE SET NULL`.

**`down()`**, in reverse order:
1. Drop the `bank_transactions` FK, then its index, then the `reconciliation_id` column. Guard each step through `information_schema` with a private `#exists` helper copied from the expand-provider-bills migration, with the table wired to `bank_transactions`, plus `hasColumn` for the column.
2. Drop the table with `DROP TABLE IF EXISTS bank_reconciliations`. That also removes `open_key`, its index and the account FK.

**Registration and specs:**
- Register the migration in `MIGRATIONS` in `database/tests/integration/test-data-source.ts`, in timestamp order, with its import. Production `data-source.ts` uses globs and needs no edit.
- Add `bank_reconciliations` in alphabetical order (after `bank_provider_expense_details`) to the hard-coded table list in `migrations-round-trip.integration-spec.ts`.
- Add the unit spec `database/tests/bank-create-reconciliations-migration.spec.ts`, using `fake-query-runner.ts`. It asserts the `up()` call order (`createTable`, `query` for the generated column, `query` for `bank_transactions`) and the SQL contents.
- In the same spec, assert the guarded `down()` order (FK, index, column, table) when everything exists, and that it skips the guarded drops when `information_schema` returns nothing. Use the `runner.query.mockImplementation` pattern from `bank-expand-provider-bills-migration.spec.ts`.

## Files to Change
- `backend/src/database/migrations/<YYYYMMDD>120027-bank-create-reconciliations.ts` — new migration
- `backend/src/database/tests/bank-create-reconciliations-migration.spec.ts` — new unit spec
- `backend/src/database/tests/integration/test-data-source.ts` — register in `MIGRATIONS`
- `backend/src/database/tests/integration/migrations-round-trip.integration-spec.ts` — add `bank_reconciliations` to the expected table list
