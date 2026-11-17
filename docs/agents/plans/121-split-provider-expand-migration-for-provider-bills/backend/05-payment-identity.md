# Provider-bill identity for new provider payments

After the migration, every provider payment row carries `provider_bill_id`. A payment written
later by the current code would not, and would land under the narrowed debt key. To keep every
row under exactly one key, make the payment writer stamp new provider payments.

- Extend `PaymentTarget` with `providerBillId: number | null`. In `bill-payment.service.ts`
  `payOccurrence`, for a `provider` source, resolve the provider's single recurring bill:
  `ProviderBill` with `{ providerAccountId: source.id, kind: 'recurring' }`. The account
  was already resolved owner-scoped by `bill-source.resolver`, so no new access path is added.
  Debt sources use `null`.
- `bill-payment.writer.ts` `#write` sets `providerBillId: target.providerBillId`. `find()` keeps
  matching on `(sourceAccountId, billId IS NULL, dueDate)`, so repointed rows are still found
  and the response shapes and pre-checks are unchanged.
- With no recurring bill (a provider whose schedule was never set cannot have derived
  occurrences), fall back to `null`. Document this in a code comment.
- Calendar, history and occurrence serialization stay unchanged: they key derived payments by
  `(sourceAccountId, dueDate)` with `billId === null`.

## Specs
- `bill-payment.writer.spec.ts` / `bill-payments.e2e-spec.ts`: paying a provider occurrence
  stores `providerBillId` = the recurring bill's id, and paying a debt occurrence stores `null`.
  A duplicate pay on the same date is still rejected, and the response bodies are unchanged.
- The Calendar, history and `accountant.e2e-spec.ts` specs stay green without assertion changes.

## Files to Change
- `backend/src/bank/bill-payment.service.ts` — resolve the recurring bill for provider occurrences.
- `backend/src/bank/bill-payment.writer.ts` — `PaymentTarget.providerBillId`, written on insert.
- `backend/src/bank/tests/bill-payment.writer.spec.ts`, `backend/src/bank/tests/bill-payments.e2e-spec.ts` — new cases.
