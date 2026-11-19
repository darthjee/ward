# ProviderBillsClient (CRUD)

Create a new client for the `provider-bills` CRUD routes. Use the same plain exported object
shape as `BillsClient` / `CalendarClient`: build paths with `contextPath` so both Personal and
`/orgs/<id>` contexts work, and filter bodies with `whitelist`.

- `listProviderBills(context, providerId, page)`: `GET accounts/:providerId/provider-bills.json?page=`.
- `getProviderBill(context, billId)`: `GET provider-bills/:id.json`.
- `createProviderBill(context, providerId, attrs)`: `POST accounts/:providerId/provider-bills.json`.
- `updateProviderBill(context, billId, attrs)`: `PATCH provider-bills/:id.json`.
- `deleteProviderBill(context, billId)`: `DELETE provider-bills/:id.json` (204).
- `PROVIDER_BILL_FIELDS` whitelist for the write bodies: `kind, description, expected_amount,
  paying_account_id, notes, charge_frequency, due_day, due_month, bills_from,
  show_in_calendar, due_date, provider_account_id`. The update path never sends `kind`.

## Files to Change
- `frontend/assets/js/client/ProviderBillsClient.js`: new client.
- `frontend/specs/assets/js/client/ProviderBillsClientSpec.js`: URL, method and body for each
  call, in both contexts. Follow the pattern in `BillsClientSpec.js`.
