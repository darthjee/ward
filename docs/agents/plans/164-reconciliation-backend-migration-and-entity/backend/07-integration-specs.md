# Integration specs (real MySQL)
These assert the schema and the formulas against the real SQL. The e2e specs only see the in-memory versions.

## `database/tests/integration/bank-schema.integration-spec.ts`
Add a `describe('bank_reconciliations')` block covering:
- the columns, and the indexes `idx_bank_reconciliations_account_id_statement_date` and `idx_bank_reconciliations_open_key` (through `schema-inspection.ts`), plus `idx_bank_transactions_reconciliation_id`;
- **Unique open:** a second open statement on the same account fails with `ER_DUP_ENTRY`. It is allowed once the first has `reconciled_at` set, and allowed on another account.
- **SET NULL:** deleting a statement nulls `reconciliation_id` on its transactions (cancel).
- **CASCADE:** deleting an account with no transactions removes its zero-row statements. Transactions keep the existing RESTRICT, so the cascade case uses a transaction-free account.

## Formula queries against the real SQL
Extend `database/tests/integration/ledger.integration-spec.ts`, or add `reconciliation.integration-spec.ts` next to it with the same helpers (`insertAccount`, `insertTransaction`, plus a new `insertReconciliation`). Cover:
- **`clearedBalance`:**
  - rows before `opening_date` are excluded;
  - only finished statements count, so an open statement's ticks do not;
  - a row of another account linked to this account's statement id is never counted.
- **Statement sequence:** the cleared balance after a finish, after an undo (`reconciled_at` set back to `NULL`), and with a second statement, which counts the first one's rows; undoing it removes them again.
- **`tickedSum`:** only rows linked to the open statement and the account.
- **Debt account:** negative balances give difference 0 (combine with `reconciliationDifference`).
- **Zero-row statement.**
- **Ledger `reconciliation`:** `null` when uncleared, `open` / `finished` with `statement_date`, and scoped (a cross-account link yields `null`). The running balance stays unchanged.
- **`lastReconciledDate`:** the latest finished date, ignoring the open statement, and `null` when there is none.
- **Constructors:** update the direct `new LedgerQuery(...)` / `new AccountBalancesQuery(...)` constructions if their signatures changed.

## Migration specs
- `migrations-registry.integration-spec.ts` passes once step 01's registration is in.
- `migrations-round-trip.integration-spec.ts` (up, down, up) stays green.

## Files to Change
- `backend/src/database/tests/integration/bank-schema.integration-spec.ts` — `bank_reconciliations` block
- `backend/src/database/tests/integration/ledger.integration-spec.ts` (or new `reconciliation.integration-spec.ts`) — formula and ledger SQL cases
