# Rename OccurrenceKind provider to provider_bill

The kind is computed, not persisted, so no data migration is needed.

## Code changes

In `backend/src/bank/bill-schedule.ts`:

- `OccurrenceKind = 'debt' | 'provider_bill' | 'bill'`.
- `BillSource.kind` becomes `'debt' | 'provider_bill'`.
- `billSourceOfProviderBill` sets `kind: 'provider_bill'`.

In `backend/src/bank/provider-bill-payment.service.ts` (L79), change
`paymentCommand(dto, recurring ? 'provider' : 'bill', …)` to `'provider_bill'`.

Sweep for any remaining `'provider'` kind literal: `grep -rn "'provider'" backend/src/bank`.
Ignore the lock-order labels, which are not kinds: `bill-payment.writer.spec.ts` L50/L179 and
`provider-bills.e2e-spec.ts` L236/L245.

Update wording that says "provider occurrences":

- the message and docs in `payment-body.ts` (which checks only `kind === 'debt'`);
- `occurrence-response.ts`.

Calendar sort order is unchanged: `'bill' < 'debt' < 'provider_bill'`.

## Specs

- `backend/src/bank/tests/calendar.e2e-spec.ts` (L95): expect `kind: 'provider_bill'`.
- `backend/src/bank/tests/calendar-units.spec.ts`: change the sort rows (L144-160) and the
  remaining provider kinds to `'provider_bill'`.
- `backend/src/bank/tests/provider-bill.schedule.spec.ts` (L63) and
  `backend/src/bank/tests/bill-payment.writer.spec.ts` (L261, L269-272): change the kind to
  `'provider_bill'`.

## Files to Change

- `backend/src/bank/bill-schedule.ts`: the type and `billSourceOfProviderBill` kind.
- `backend/src/bank/provider-bill-payment.service.ts`: the payment command kind.
- `backend/src/bank/payment-body.ts` and `backend/src/bank/occurrence-response.ts`: wording and
  types.
- `backend/src/bank/tests/calendar.e2e-spec.ts`,
  `backend/src/bank/tests/calendar-units.spec.ts`,
  `backend/src/bank/tests/provider-bill.schedule.spec.ts` and
  `backend/src/bank/tests/bill-payment.writer.spec.ts`: the kind rename.
