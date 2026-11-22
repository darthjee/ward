# Single-transaction response carries payment_generated

Give the POST and PATCH responses the same `payment_generated` field, so the transaction shape
is the same everywhere.

- `backend/src/bank/transaction-response.ts`: add `payment_generated: boolean` to
  `TransactionResponse`, and a `paymentGenerated: boolean` argument to
  `serializeTransaction(transaction, account, paymentGenerated)`.
- `backend/src/bank/transaction.service.ts`:
  - `create()` passes `false`: a just-created transaction cannot be referenced by a bill payment.
  - `update()` calls `paymentGeneratedQuery.isPaymentGenerated(owner, transaction.id)` once,
    for every role, before the edit. `#assertMayEdit` reuses that result instead of running its
    own query (it still rejects below `admin` with the same 403). The same value is passed to
    `serializeTransaction`. This keeps a single query per PATCH. The 403 behaviour for `user`
    must not change.
- Specs:
  - `transaction-response.spec.ts`: `serializeTransaction` output includes the flag for both
    values.
  - `transaction.service.spec.ts`: create returns `false` without calling the query; update
    calls `isPaymentGenerated` once for `admin`, `owner` and the personal context too, returns
    the flag, and a `user` still gets the 403 on a payment-generated transaction.
  - `transactions.e2e-spec.ts` ("create, edit and delete"): responses include
    `payment_generated: false`.
  - `org-roles.e2e-spec.ts`: an `admin` PATCH of a payment-generated transaction answers with
    `payment_generated: true`.
  - `transactions.controller.spec.ts`: update only if it asserts the full response shape.

## Files to Change
- `backend/src/bank/transaction-response.ts` — `TransactionResponse` and `serializeTransaction`
- `backend/src/bank/transaction.service.ts` — create/update pass the flag; single query in update
- `backend/src/bank/tests/transaction-response.spec.ts` — single-transaction shape
- `backend/src/bank/tests/transaction.service.spec.ts` — query called once, flag returned, 403 kept
- `backend/src/bank/tests/transactions.e2e-spec.ts` — POST/PATCH responses
- `backend/src/bank/tests/org-roles.e2e-spec.ts` — admin PATCH returns `true`
- `backend/src/bank/tests/transactions.controller.spec.ts` — only if it checks the shape
