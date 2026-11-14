# Calendar and payment client calls

Add a plain-object `CalendarClient`, shaped like `BillsClient`. Each method takes `context`
first and builds its path with `contextPath`.

- `getCalendar(context, from, to)`: GET `/bank/calendar.json?from=<from>&to=<to>`.
- `getOverdue(context)`: GET `/bank/calendar/overdue.json`.
- `payOccurrence(context, accountId, nominalDate, body)`: POST
  `/bank/accounts/:accountId/occurrences/:nominalDate/payment.json`.
- `payBill(context, billId, body)`: POST `/bank/bills/:id/payment.json`.
- `PAYMENT_FIELDS = ['status','paid_on','amount','paying_account_id','record_charge']`. Filter
  the body with `whitelist`.
- Add the body builders here or in step 04:
  - `paymentBody(occ, fields)` sends `record_charge` only when `kind` is `provider` or `bill`;
  - `SKIP_BODY = {status:'skipped'}`.

Undo reuses the existing `BillsClient.undoOccurrencePayment` / `undoBillPayment`, so do not
duplicate them. Add an `undoFor(occ)`-style dispatcher in the controller, in step 04.

Specs loop over the `CONTEXTS` table (Personal, and org 5 with the prefix `/orgs/5`) and assert
the path, the method and the body. They also cover:
- the `ApiError` propagation;
- that `record_charge` is dropped for debts and for skips.

## Files to Change
- `frontend/assets/js/client/CalendarClient.js`: new.
- `frontend/specs/assets/js/client/CalendarClientSpec.js`: new.
