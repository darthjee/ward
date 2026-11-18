# Writer: per-bill lookup, lock and re-check

Make `BillPaymentWriter` safe per bill and close the #122 race gap.

- `PaymentTarget`:
  - widen the `find()` `Pick` to include `providerBillId`;
  - `find()` gets three branches:
    - `providerBillId !== null` → `{ providerBillId, dueDate: nominal }`;
    - `billId !== null` → `{ billId }`;
    - otherwise (debt) → `{ sourceAccountId, billId IS NULL, providerBillId IS NULL, dueDate }`.
- `#recheck` inside the transaction, for any target with a provider bill (recurring
  `providerBillId` or one-off `billId`), in this order (see backend.md Notes):
  1. Share-lock (`pessimistic_read`) the provider account row.
  2. Lock the `ProviderBill` row `FOR UPDATE`, re-read it, and answer `404` if it is gone (a
     concurrent `DELETE`).
  3. Re-check the occurrence against the locked row through `isProviderBillOccurrence` (step 01)
     and answer `404` if a concurrent `PATCH` moved it. This covers one-offs too (`due_date`
     equality).
  4. Share-lock the paying account through `PayingAccountResolver` (generic `422`), as today.
  - Then the pre-existing duplicate check: same bill + date gives `409 OCCURRENCE_ALREADY_PAID`.
    The unique keys stay the final guard.
- `#write` is unchanged: three transactions, `providerBillId` stamped, description from
  `paymentDescription(target.label, target.nominal)`.
- Tests:
  - `bill-payment.writer.spec.ts`:
    - the three `find()` branches;
    - lock order recorded in the in-memory `locks`;
    - `404` on a deleted or moved bill;
    - `409` when paying the same bill and date twice;
    - two bills of one provider on the same date both succeed with **distinct descriptions**.
  - `database/tests/integration/bill-payments.integration-spec.ts` (MySQL):
    - delete-vs-pay (the delete waits and its cascade sees the payment, giving
      `409 PROVIDER_BILL_PAID` or a consistent `404`);
    - patch-vs-pay without a deadlock;
    - two bills of one provider paid concurrently.

## Files to Change
- `backend/src/bank/bill-payment.writer.ts` — three-branch `find()`, provider → bill → paying lock and re-check
- `backend/src/bank/tests/bill-payment.writer.spec.ts` — extend
- `backend/src/bank/tests/support/in-memory-bank-repos.ts` — support the new locks and lookups if needed
- `backend/src/database/tests/integration/bill-payments.integration-spec.ts` — race tests
