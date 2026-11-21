# Payment-generated transaction rule

A transaction is payment-generated when its id appears in any of
`bank_bill_payments.payment_transaction_id`, `withdrawal_transaction_id` or
`charge_transaction_id`. `BillPaymentWriter` writes these columns. Only an `admin` or `owner`
may edit such a transaction. The route stays `@MinOrgRole('user')`.

In `bank/transaction.service.ts` `update(owner, accountId, transactionId, dto)`:

- Keep the existing lookups: owned account (404), archived (409), then
  `#findTransaction(account, transactionId)` (404). An unknown or wrong-context transaction
  still gets 404.
- Then, **for every role below `admin`** (`!hasMinRole(ownerRole(owner), OrgRole.ADMIN)`, so an
  unknown role is checked too — fail-closed), run one owner-scoped `EXISTS` through
  `PaymentGeneratedQuery#isPaymentGenerated(owner, id)` (`bank/payment-generated.query.ts`).
  `BillPayment` carries no owner columns (its owner is its source account), so the raw SQL joins
  `bank_bill_payments p` to `bank_accounts a ON a.id = p.source_account_id`, ORs over
  `payment_transaction_id`, `withdrawal_transaction_id` and `charge_transaction_id` (each has an
  FK index) and applies `ownerSqlWhere(owner, 'a')`. A bill payment of another owner or context
  never counts.
- A match throws `orgRoleForbidden()`. `owner`, `admin` and personal context skip the query
  entirely.
- `PaymentGeneratedQuery` is registered in `BankModule`; specs swap in
  `bank/tests/support/in-memory-payment-generated.query.ts` with `jest.mock`, and
  `src/database/tests/integration/payment-generated.integration-spec.ts` covers the real SQL.
- Update the class doc and the `update` JSDoc (`@throws {ForbiddenException}`).
- `DELETE` is already `admin` at the route, so it needs no extra check.

Fake query: `bank/tests/support/in-memory-payment-generated.query.ts` mirrors the SQL (same
class name and injection), matching the payment's source account against the owner.

Tests:

- `bank/tests/transaction.service.spec.ts` (or the existing update spec):
  - `user` editing a payment-generated transaction (once per column) → `ForbiddenException`;
  - `admin`, `owner` and personal → allowed, and the `EXISTS` query is not called;
  - `user` editing a plain transaction → allowed;
  - an unknown transaction as `user` → 404, with no `EXISTS` call;
  - a bill payment of another owner context referencing the id → no 403;
  - an unknown role → checked like `user` (fail-closed).
- e2e (in the step 06 spec or the transactions e2e): pay a bill as the org owner, then `PATCH`
  the generated transaction. A `user` gets `UNIFORM_403`; an `admin` gets 200. A bill payment of
  another owner context referencing a plain transaction's id leaves a `user` edit at 200.

## Files to Change
- `backend/src/bank/transaction.service.ts` — inject `PaymentGeneratedQuery`; role-gated (fail-closed) check; docs.
- `backend/src/bank/payment-generated.query.ts` — new: the owner-scoped `EXISTS`.
- `backend/src/bank/bank.module.ts` — register the query provider.
- `backend/src/bank/tests/support/in-memory-payment-generated.query.ts` — new: in-memory stand-in.
- `backend/src/bank/tests/payment-generated.query.spec.ts` — SQL/params unit spec.
- `backend/src/bank/tests/transaction.service.spec.ts` — role and owner-scope cases.
- `backend/src/bank/tests/org-roles.e2e-spec.ts`, `transactions.e2e-spec.ts` — e2e cases / `jest.mock`.
- `backend/src/database/tests/integration/payment-generated.integration-spec.ts` — real SQL.
