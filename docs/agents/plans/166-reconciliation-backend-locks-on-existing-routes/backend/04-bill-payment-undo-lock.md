# Bill-payment undo lock

Block the three undo routes in one place: `undoPayment()` (`bill-payment-undo.ts`) and
`BillPaymentWriter.remove()` (`bill-payment.writer.ts`). The routes are the debt occurrence, the
one-off `bills/:id/payment`, and the provider-bill occurrence.

- In `remove()`, wrap the transaction in `mapDeadlock(...)` and follow the common lock order
  inside it:
  1. lock the account rows involved, in ascending id order: the source account, and the paying
     account when it differs (the withdrawal row lives there);
  2. lock the open statements of those accounts when one of the rows is ticked;
  3. lock the linked transaction rows (`paymentTransactionId`, `withdrawalTransactionId`,
     `chargeTransactionId`) in ascending id order, with `ReconciliationQuery.lockTransactions`
     per account or one `FOR UPDATE` by id.
- If **any** linked row is cleared, answer `transactionCleared()` and delete nothing. A ticked row
  is deleted, and its tick goes with it (the statement totals recompute from the remaining
  ticks).
- Re-check the archived rule from `undoPayment()` under the account locks, so it cannot race an
  archive.
- A skipped payment (no linked rows) keeps undoing exactly as today.
- Bill and provider-bill DELETE are unchanged: they are already 409 when paid.

Tests (`bill-payments.e2e-spec.ts`, adding only new cases; existing cases stay as they are), for
each of the three undo routes:

- blocked with `TRANSACTION_CLEARED` when a generated row is cleared;
- allowed when ticked, with the tick dropped and the open statement's `ticked_sum` and
  `difference` recomputed;
- several linked rows with only one cleared: blocked, and none of the rows is deleted;
- a skipped payment still undoes;
- a finish interleaved between the pre-check and the write (`beforeNextTransaction`) ends as
  listed under `security.md` § Concurrency;
- `bill-payment.writer.spec.ts` units: lock order, cleared block, deadlock mapping.

Run `accountant.e2e-spec.ts`, `bills.e2e-spec.ts` and `provider-bills.e2e-spec.ts` too: they must
stay green. Add only the in-memory `reconciliation.query` mock line if the new dependency
requires it.

## Files to Change
- `backend/src/bank/bill-payment.writer.ts` — locked, deadlock-mapped `remove()` with the cleared check
- `backend/src/bank/bill-payment-undo.ts` — archived re-check under the lock, if it moves into the writer
- `backend/src/bank/tests/bill-payment.writer.spec.ts` — units
- `backend/src/bank/tests/bill-payments.e2e-spec.ts` — the three undo routes' lock cases
