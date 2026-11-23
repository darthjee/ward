# Balance and ledger queries
## `AccountBalancesQuery` (`backend/src/bank/account-balances.query.ts`)
Add two methods next to `currentBalance()` and leave the existing methods untouched. Each one reads the `SUM` as a string and converts it with `sumToBigInt` (step 04).
- **`clearedBalance(account: Account): Promise<bigint>`** returns the opening balance plus the cleared sum:
  `SUM(t.amount)` over `bank_transactions t INNER JOIN bank_accounts a ON a.id = t.account_id INNER JOIN bank_reconciliations r ON r.id = t.reconciliation_id AND r.account_id = t.account_id AND r.reconciled_at IS NOT NULL WHERE t.account_id = :account AND t.date >= a.opening_date`.
  - Rows before the anchor are excluded, and only finished statements count.
  - A row of another account never counts, because of the `r.account_id = t.account_id` scope.
  - Reuse the QueryBuilder style of `currentBalances()`.
- **`tickedSum(accountId: number, reconciliationId: number): Promise<bigint>`** runs `SUM(t.amount) WHERE t.reconciliation_id = :open AND t.account_id = :account`.
- One query with conditional `SUM`s is allowed but not required (model.md § Queries and indexes).
- Extend the builder fake in `bank/tests/account-balances.query.spec.ts` for the new chain calls. Add unit cases for both methods (joins and conditions, `NULL` → opening / `0n`). Keep the existing cases unchanged.

## `LedgerQuery` (`backend/src/bank/ledger.query.ts`)
- **`reconciliation` on each row.** `LedgerRow` gains `reconciliation: { id: number; status: 'open' | 'finished'; statementDate: string } | null`.
  - **SQL:** select `t.reconciliation_id` and `t.account_id` in the inner window subquery. Then, outside the subquery and so only on the at most 50 limited rows (the recommended placement), add `LEFT JOIN bank_reconciliations r ON r.id = ledger.reconciliation_id AND r.account_id = ledger.account_id`, selecting `r.id`, `r.reconciled_at` and `DATE_FORMAT(r.statement_date,'%Y-%m-%d')`.
  - **Mapping:** map these into the object with `reconciliationStatus()` (step 04). A missing `r.id` gives `null`.
  - Keep the window `SUM`s, the order and the `LIMIT` / `OFFSET` unchanged.
- **`lastReconciledDate(accountId: number): Promise<string | null>`** runs `SELECT DATE_FORMAT(MAX(statement_date),'%Y-%m-%d') AS last FROM bank_reconciliations WHERE account_id = ? AND reconciled_at IS NOT NULL`, served by `(account_id, statement_date)`.
- **Constructor:** add `@InjectRepository(Reconciliation)` only if it is actually needed. The raw `transactionRepository.query()` can run both SQLs, so keeping the constructor unchanged is preferred: it avoids touching every direct construction.
- **Not wired yet.** Do **not** wire either field into `transaction.service.ts` `ledger()` or `serializeLedger`. That is #166. Check that `serializeLedger` maps fields explicitly rather than spreading `LedgerRow`, so the response shape does not change. If it spreads, strip `reconciliation` there until #166.
- **Spec:** update `bank/tests/ledger.query.spec.ts` for the new SQL and row mapping:
  - uncleared → `null`, open → `{ status: 'open' }`, finished → `{ status: 'finished' }`;
  - `lastReconciledDate` returns a value, and `null` when there is none.

## Files to Change
- `backend/src/bank/account-balances.query.ts` — `clearedBalance`, `tickedSum`
- `backend/src/bank/ledger.query.ts` — scoped `reconciliation` join, `LedgerRow.reconciliation`, `lastReconciledDate`
- `backend/src/bank/tests/account-balances.query.spec.ts` — new cases and builder fake
- `backend/src/bank/tests/ledger.query.spec.ts` — new cases and updated SQL assertions
