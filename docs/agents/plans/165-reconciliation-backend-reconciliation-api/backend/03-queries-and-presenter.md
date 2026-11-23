# Statement queries and response presenter

## Query class

Add a narrow query class, `ReconciliationQuery`. It keeps every bulk or aggregate operation in
SQL, with no entity hydration (security.md § Memory). All methods run on a passed
`EntityManager` when they are called inside a write transaction.

**Locking and ticks:**

- `lockTransactions(manager, accountId, ids)` runs
  `SELECT id, date, amount, reconciliation_id … WHERE account_id = :account AND id IN (:ids)
  ORDER BY id FOR UPDATE`. It selects narrow columns only and returns at most 50 rows.
- `tick(manager, statementId, ids)` runs one bulk `UPDATE … SET reconciliation_id = :statement
  WHERE id IN (:ids)`.
- `untick(manager, statementId, ids)` runs `UPDATE … SET reconciliation_id = NULL WHERE id IN
  (:ids) AND reconciliation_id = :statement`. Rows that are unlinked, or linked to a finished
  statement, are therefore a no-op.
- `untickAfter(manager, statementId, statementDate)` is for an edit that moves `statement_date`
  earlier. It unlinks the ticked rows dated after the new date.

**Counts and history:**

- `transactionCounts(statementIds)` runs one grouped `COUNT(*) … GROUP BY reconciliation_id` for
  up to 50 ids. It must never run one query per row.
- `latestFinished(accountId, manager?)` and `openStatement(accountId, manager?)` are served by
  `(account_id, statement_date)` and `open_key`.
- `historyPage(accountId, page)` returns rows newest first by `statement_date DESC, id DESC`,
  50 per page, plus the total count. The open statement is naturally first, because its date is
  the latest. If ordering alone cannot guarantee that, order by `reconciled_at IS NULL DESC`
  first.

**Test support:**

- Register the class in `BankModule`.
- Add an in-memory twin in `tests/support/`, following `in-memory-ledger.query.ts`, so the e2e
  specs can `jest.mock` it.
- Add an integration spec in `database/tests/integration/reconciliation.integration-spec.ts`
  asserting against real MySQL:
  - the bulk `UPDATE`s stay scoped to the account and the statement;
  - the grouped count;
  - the history order.

## Presenter

Add a presenter, `reconciliation-response.ts`:

- `presentStatement(statement, { clearedBalance, tickedSum, transactionCount }, currency)`
  returns `{ id, status, statement_date, statement_balance, reconciled_at, cleared_balance,
  ticked_sum, difference, transaction_count, created_at, updated_at }`.
  - Amounts are decimal strings in the account currency, formatted like the other bank
    responses.
  - `status` comes from `reconciliationStatus()`.
  - `difference` comes from `reconciliationDifference()`, as a `BigInt`.
- `presentHistoryRow(statement, transactionCount, undoable)` returns `{ id, status,
  statement_date, statement_balance, reconciled_at, transaction_count, undoable }`.
- No output carries an owner, user or member field.

On a finished statement, the ticked sum is the amount it cleared: `SUM` over the rows linked to
it. `difference` is `0`, and `cleared_balance` already includes those rows. Confirm how
`clearedBalance()` and `tickedSum()` combine for a finished statement so that `difference` comes
out `"0…"`. If needed, the presenter derives `cleared_balance` as the balance before this
statement.

Add presenter unit specs covering open, finished and zero-row statements, a negative balance,
and `difference` as a `BigInt`.

## Files to Change
- `backend/src/bank/reconciliation.query.ts` (new) — the locking select, the bulk tick/untick,
  the grouped count, latest/open lookups and the history page.
- `backend/src/bank/reconciliation-response.ts` (new) — the statement and history-row presenters.
- `backend/src/bank/bank.module.ts` — register `ReconciliationQuery`.
- `backend/src/bank/tests/support/in-memory-reconciliation.query.ts` (new) — the in-memory twin
  for the e2e specs.
- `backend/src/bank/tests/reconciliation-response.spec.ts` (new) — the presenter unit specs.
- `backend/src/database/tests/integration/reconciliation.integration-spec.ts` — the real-SQL
  assertions for the new queries.
