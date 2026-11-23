# Backward compatibility and migration

Rewrite `model.md#migration` so it gives the implementation issue a complete contract for the
migration. Then record the decision in `security.md`'s `Decided` table.

**Migration shape** (one file, additive, no backfill)
- The file is `backend/src/database/migrations/<YYYYMMDD>120027-bank-create-reconciliations.ts`,
  class `BankCreateReconciliations<YYYYMMDD>120027`. The counter continues after
  `20261120120026-bank-contract-provider-bills.ts`.
- `up()` runs in this order:
  1. Create `bank_reconciliations`:
     - columns `id`, `account_id`, `statement_date DATE`, `statement_balance BIGINT`,
       `reconciled_at DATETIME NULL`, `created_at`, `updated_at`;
     - FK `account_id → bank_accounts.id ON DELETE CASCADE`;
     - index `(account_id, statement_date)`.
  2. Raw SQL: add the generated column
     `open_key INT AS (IF(reconciled_at IS NULL, account_id, NULL)) VIRTUAL` and its unique index.
     This mirrors `active_name_key` in `20261108120016-bank-create-accounts.ts`. An `INT` needs
     no collation.
  3. Raw SQL on `bank_transactions`:
     - `ADD COLUMN reconciliation_id INT NULL`;
     - `ADD INDEX idx_bank_transactions_reconciliation_id (reconciliation_id)`;
     - `ADD CONSTRAINT fk_... FOREIGN KEY (reconciliation_id) REFERENCES bank_reconciliations(id) ON DELETE SET NULL`.

     The precedent is `20261117120025-bank-expand-provider-bills.ts:67-71`.
- Raw SQL is required because TypeORM's helpers would hit the `typeorm_metadata` table, which
  the project never creates.
- `down()` is reversible, and the reconcile data is lost on rollback:
  1. drop the transaction FK, then its index, then the column, each guarded through
     `information_schema`;
  2. drop `bank_reconciliations` with `DROP TABLE IF EXISTS`. That also removes `open_key`, its
     unique index, the `(account_id, statement_date)` index and the account FK.
  Replace the current one-line "drops the column and then the table", which is incomplete.

**Backward compatibility** (new short subsection or bullet list in `model.md#migration`)
- Every existing transaction starts uncleared (`reconciliation_id NULL`). No backfill is run.
- Existing clients keep working, for two reasons:
  - The new response fields are additive: `reconciliation` (`null` on every existing row),
    `last_reconciled_date` (`null`), `last_reconciliation` (`null`) and
    `open_reconciliation_id` (`null`).
  - The new 409s apply only once a statement exists: `TRANSACTION_CLEARED`, `ACCOUNT_RECONCILED`
    and the widened `CURRENCY_LOCKED`. Until a user starts their first statement, every current
    rule and response behaves as today.
- `reconciliation_id` and `reconciliation` join the 400 mass-assignment list, which was already
  decided. A client that never sends them is unaffected.

**Required tests** (update `model.md#required-tests`)
- A unit spec `database/tests/bank-create-reconciliations-migration.spec.ts` (with
  `fake-query-runner.ts`) asserting the `up()` and `down()` call order.
- The migration registered in `MIGRATIONS` of `test-data-source.ts`, so
  `migrations-registry.integration-spec.ts` passes.
- `migrations-round-trip.integration-spec.ts` (up, down, up) stays green with the new migration.
- The existing unique-open index integration spec stays as listed.

## Files to Change
- `docs/agents/specs/reconciliation/model.md`: rewrite `## Migration` (shape, raw SQL, `down()`
  order, backward compatibility, data loss on rollback); update `## Required tests`.
- `docs/agents/specs/reconciliation/security.md`: add a `Backward compatibility and migration`
  row to the `Decided` table that summarises the above and links `model.md#migration`.
