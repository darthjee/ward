# Payment-generated transaction rule

A transaction is payment-generated when its id appears in any of
`bank_bill_payments.payment_transaction_id`, `withdrawal_transaction_id` or
`charge_transaction_id`. `BillPaymentWriter` writes these columns. Only an `admin` or `owner`
may edit such a transaction. The route stays `@MinOrgRole('user')`.

In `bank/transaction.service.ts` `update(owner, accountId, transactionId, dto)`:

- Keep the existing lookups: owned account (404), archived (409), then
  `#findTransaction(account, transactionId)` (404). An unknown or wrong-context transaction
  still gets 404.
- Then, **only when `ownerRole(owner) === 'user'`**, run one `EXISTS` against `BillPayment`:
  `billPaymentRepository.exists({ where: [{ paymentTransactionId: id }, {
  withdrawalTransactionId: id }, { chargeTransactionId: id }] })`. Each column has an FK index.
  Scope it through the owner context: the transaction was already found inside an owned account.
  If `BillPayment` carries owner columns, also add `ownerWhere(owner)` to each branch.
- A match throws `orgRoleForbidden()`. `owner`, `admin` and personal context skip the query
  entirely.
- Inject `@InjectRepository(BillPayment)`. `BillPayment` is already in `forFeature`. If the
  service nears the 300-line cap, extract a `PaymentGeneratedTransactionQuery` provider with
  `isPaymentGenerated(id): Promise<boolean>`.
- Update the class doc and the `update` JSDoc (`@throws {ForbiddenException}`).
- `DELETE` is already `admin` at the route, so it needs no extra check.

Fake repo: extend `bank/tests/support/in-memory-bank-repos.ts` so that `exists`/`existsBy`
accept a `Where[]` (true if any branch matches), like `find` does.

Tests:

- `bank/tests/transaction.service.spec.ts` (or the existing update spec):
  - `user` editing a payment-generated transaction (once per column) → `ForbiddenException`;
  - `admin`, `owner` and personal → allowed, and the `EXISTS` query is not called;
  - `user` editing a plain transaction → allowed;
  - an unknown transaction as `user` → 404, with no `EXISTS` call.
- e2e (in the step 06 spec or the transactions e2e): pay a bill as the org owner, then `PATCH`
  the generated transaction. A `user` gets `UNIFORM_403`; an `admin` gets 200.

## Files to Change
- `backend/src/bank/transaction.service.ts` — inject the `BillPayment` repo (or a query provider); role-gated `EXISTS` check; docs.
- `backend/src/bank/payment-generated-transaction.query.ts` — new (only if extracted).
- `backend/src/bank/bank.module.ts` — register the query provider (only if extracted).
- `backend/src/bank/tests/support/in-memory-bank-repos.ts` — `exists`/`existsBy` with `Where[]`.
- `backend/src/bank/tests/transaction.service.spec.ts` — role cases.
- `backend/src/bank/tests/org-roles.e2e-spec.ts` — payment-generated e2e case.
