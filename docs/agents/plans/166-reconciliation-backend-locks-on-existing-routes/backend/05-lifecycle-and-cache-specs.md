# Lifecycle spec and cache assertions

**Lifecycle**: in `tests/reconciliation-lifecycle.e2e-spec.ts` (around lines 145–151), remove the
placeholder comment and turn the four `it.todo('(#166) ...')` cases into real tests. Use the
existing `setup()` helpers (`start`, `ticks`, `finish`, `undo`, `cancel`, `show`, `linkOf`):

- a cleared row: PATCH `amount` / `date` and DELETE answer 409 `TRANSACTION_CLEARED`, and a
  `description` edit is allowed;
- once undone, the rows of the statement unlock again (PATCH `amount` and DELETE succeed);
- the account anchor (opening date and balance) and the currency are 409 while a statement
  exists, open or finished;
- the anchor and currency locks are released when the last statement is cancelled, and are still
  held after an undo.

Drop the `(#166)` prefix from the titles.

**Cache classes**: confirm that the ledger GET and the account-detail GET (class-level policy on
`@OwnerScopedController('bank')`) send `X-Cache-Allow: true` with the user-scoped
`Cache-Control`. Confirm that 2xx transaction, account and payment-undo writes carry
`x-cache-invalidate` equal to the owner base, and that a 409 (`TRANSACTION_CLEARED`,
`ACCOUNT_RECONCILED`, `CURRENCY_LOCKED`) carries none. Add these assertions where they are missing,
in `transactions.e2e-spec.ts` and `accounts.e2e-spec.ts`. Do not change any `@CachePolicy`, and do
not change `navi/navi_config.yaml`.

Finish by running the CI checks listed in `backend.md`: lint, typecheck, coverage and integration.

## Files to Change
- `backend/src/bank/tests/reconciliation-lifecycle.e2e-spec.ts` — enable the four cases
- `backend/src/bank/tests/transactions.e2e-spec.ts` — cache header assertions on the ledger and the writes
- `backend/src/bank/tests/accounts.e2e-spec.ts` — cache header assertions on the detail and the PATCH
