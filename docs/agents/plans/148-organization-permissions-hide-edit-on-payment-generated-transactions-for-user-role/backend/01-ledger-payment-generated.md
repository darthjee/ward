# Ledger rows carry payment_generated

Add `payment_generated` to every ledger row, computed set-based inside the ledger SQL.

- `backend/src/bank/ledger.query.ts` (`LedgerQuery`):
  - `page(account, page, perPage)` becomes `page(owner: OwnerScope, account, page, perPage)`.
  - In the inner subquery of `LEDGER_PAGE_SQL` (next to `t.sent_to_accountant_at`), add:

    ```sql
    EXISTS (SELECT 1 FROM bank_bill_payments p
      JOIN bank_accounts a ON a.id = p.source_account_id
     WHERE (p.payment_transaction_id = t.id
         OR p.withdrawal_transaction_id = t.id
         OR p.charge_transaction_id = t.id)
       AND <ownerSqlWhere(owner, 'a').sql>) AS payment_generated
    ```

    Also add `payment_generated` to the outer SELECT list. Use the same SQL shape as
    `PaymentGeneratedQuery` (`backend/src/bank/payment-generated.query.ts`), and extract a
    shared SQL fragment builder if that keeps the two from drifting.
  - Put the owner params at the right place in the params array. The `EXISTS` placeholders come
    before the `t.date < ?` anchor param when the `EXISTS` sits earlier in the SELECT list.
  - Add `payment_generated` to `RawLedgerRow` and `paymentGenerated: boolean` to `LedgerRow`,
    mapped with `Number(raw.payment_generated) === 1`.
- `backend/src/bank/transaction.service.ts`: `ledger()` passes `owner` to `ledgerQuery.page`.
- `backend/src/bank/transaction-response.ts`: add `payment_generated: boolean` to
  `LedgerRowResponse`, and `payment_generated: row.paymentGenerated` in `serializeLedger`.
- Test fakes: `backend/src/bank/tests/support/in-memory-ledger.query.ts` takes `owner` and
  computes `paymentGenerated` from the in-memory bill-payment and account repos, with the same
  owner rule. Wire any new dependency in `build-bank-test-app.ts` / `in-memory-bank-repos.ts`.
- Specs:
  - `transaction-response.spec.ts`: `serializeLedger` output includes `payment_generated`.
  - `transaction.service.spec.ts`: `ledger()` passes the owner through.
  - `transactions.e2e-spec.ts` ("ledger envelope"): ordinary rows have
    `payment_generated: false`.
  - `org-roles.e2e-spec.ts` ("a payment-generated transaction"): the ledger row of that
    transaction has `payment_generated: true`.
  - `database/tests/integration/ledger.integration-spec.ts` (MySQL): a row referenced by a
    payment, a withdrawal and a charge id is `true`; an ordinary row is `false`; a bill payment
    owned by another owner leaves the row `false`.

## Files to Change
- `backend/src/bank/ledger.query.ts` — `owner` param, `EXISTS` column, row types and mapping
- `backend/src/bank/payment-generated.query.ts` — optional shared SQL fragment
- `backend/src/bank/transaction.service.ts` — pass `owner` to `ledgerQuery.page`
- `backend/src/bank/transaction-response.ts` — `LedgerRowResponse` and `serializeLedger`
- `backend/src/bank/tests/support/in-memory-ledger.query.ts` — owner-aware fake flag
- `backend/src/bank/tests/support/build-bank-test-app.ts`, `in-memory-bank-repos.ts` — wiring, if needed
- `backend/src/bank/tests/transaction-response.spec.ts` — ledger shape
- `backend/src/bank/tests/transaction.service.spec.ts` — owner passed to the ledger query
- `backend/src/bank/tests/transactions.e2e-spec.ts` — ledger envelope rows
- `backend/src/bank/tests/org-roles.e2e-spec.ts` — payment-generated row flag
- `backend/src/database/tests/integration/ledger.integration-spec.ts` — real SQL cases
