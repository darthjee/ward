# Calendar pay / skip / undo per bill

In `CalendarActionsController`, route pay, skip and undo through the per-bill routes whenever
`occ.source_bill` is set. This covers recurring and one-off provider bills:

- Pay or skip uses
  `ProviderBillsClient.payOccurrence(context, occ.source_bill.id, occ.nominal_date, body)`.
- Undo uses
  `ProviderBillsClient.undoOccurrencePayment(context, occ.source_bill.id, occ.nominal_date)`.

Debts (no `source_bill`) keep the account routes: `CalendarClient.payOccurrence` and
`BillsClient.undoOccurrencePayment`.

Keep the legacy `bill` branch (`payBill` / `undoBillPayment`) only as a fallback when
`source_bill` is missing. `CalendarActions.jsx`'s `isOneOff` check stays as it is.

## Files to Change
- `frontend/assets/js/components/resources/bank/calendar/common/controllers/CalendarActionsController.js`:
  per-bill routing.
- Specs: `CalendarActionsControllerSpec` covers pay, skip and undo for a recurring provider
  bill, a one-off provider bill (both per-bill), and a debt (account route).
