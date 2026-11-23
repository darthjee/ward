# Ledger response fields

Expose what `LedgerQuery` already computes.

- `transaction-response.ts`:
  - Add `reconciliation: { id: number; status: 'open' | 'finished'; statement_date: string } | null`
    to `LedgerRowResponse`. Map it from `row.reconciliation` in `serializeLedger`. The virtual
    `opening` row (`LedgerOpeningResponse`) never carries it.
  - Add `last_reconciled_date: string | null` to `LedgerResponse`, and pass it into
    `serializeLedger`.
- `transaction.service.ts` `ledger()`: call `ledgerQuery.lastReconciledDate(account.id)` next to
  the `COUNT` (on every page, including an empty or out-of-range page), and pass it to the
  serializer.
- The join placement (outside the window subquery) is already in place. Do not move it.

Tests:

- `tests/transaction-response.spec.ts`: `reconciliation` is mapped, including `null`. The opening
  row has no `reconciliation`. `last_reconciled_date` is in the envelope.
- `tests/transaction.service.spec.ts`: `ledger()` passes `lastReconciledDate` through.
- `transactions.e2e-spec.ts`: ledger rows carry `null` / open / finished `reconciliation`, and the
  envelope carries `last_reconciled_date` after a finish, then `null` again after an undo (use the
  #165 routes to set up the statements).
- The ledger query units (`tests/ledger.query.spec.ts`) and the real-SQL integration spec
  (`database/tests/integration/reconciliation.integration-spec.ts`) already cover the join scope
  and `lastReconciledDate`. Check them against the bullets of `model.md` § Required tests. Add any
  missing case, for example a reconciliation of another account never joined.

## Files to Change
- `backend/src/bank/transaction-response.ts` — `reconciliation` on ledger rows, `last_reconciled_date` on the envelope
- `backend/src/bank/transaction.service.ts` — `ledger()` fetches `lastReconciledDate`
- `backend/src/bank/tests/transaction-response.spec.ts` — serializer cases
- `backend/src/bank/tests/transaction.service.spec.ts` — ledger envelope case
- `backend/src/bank/tests/transactions.e2e-spec.ts` — ledger e2e cases
- `backend/src/database/tests/integration/reconciliation.integration-spec.ts` — only if a join-scope case is missing
