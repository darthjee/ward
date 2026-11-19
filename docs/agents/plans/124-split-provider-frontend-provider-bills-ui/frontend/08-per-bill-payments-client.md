# Per-bill payment and history client calls

Extend `ProviderBillsClient` with the per-bill payment routes from #123:

- `listBillPayments(context, billId, page)`: `GET provider-bills/:id/bill-payments.json?page=`.
- `payOccurrence(context, billId, dueDate, body)`:
  `POST provider-bills/:id/occurrences/:dueDate/payment.json`. Build the body with the
  existing `CalendarClient.paymentBody` logic, so `record_charge` is handled the same way.
- `undoOccurrencePayment(context, billId, dueDate)`:
  `DELETE provider-bills/:id/occurrences/:dueDate/payment.json`.

## Files to Change
- `frontend/assets/js/client/ProviderBillsClient.js`: add the three calls.
- `frontend/specs/assets/js/client/ProviderBillsClientSpec.js`: per-bill URLs, methods and
  bodies, in both contexts.
