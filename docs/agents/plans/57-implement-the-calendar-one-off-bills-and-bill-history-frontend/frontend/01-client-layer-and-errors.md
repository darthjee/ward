# Client layer and 422 classification

Prepare the HTTP layer and the error classification every later step relies on.

- `client/TypedAccountsClient.js`: add `bills_from`, `show_in_calendar` and `paying_account_id`
  to both `DEBT_FIELDS` and `PROVIDER_EXPENSE_FIELDS`, otherwise `whitelist()` drops them.
- New `client/BillsClient.js` (plain object, same style as the other clients, built on
  `ApiClient` and `contextPath`):
  - `getBill(context, id)` → `GET <base>/bills/:id.json`
  - `createBill(context, body)` → `POST <base>/bills.json`
  - `updateBill(context, id, body)` → `PATCH <base>/bills/:id.json`
  - `deleteBill(context, id)` → `DELETE <base>/bills/:id.json`
  - `listBillPayments(context, accountId, page)` →
    `GET <base>/accounts/:accountId/bill-payments.json?page=N`
  - `undoOccurrencePayment(context, accountId, dueDate)` →
    `DELETE <base>/accounts/:accountId/occurrences/:dueDate/payment.json`
  - `undoBillPayment(context, billId)` → `DELETE <base>/bills/:billId/payment.json`
  - Whitelist the bill body with `BILL_FIELDS = [provider_account_id, paying_account_id,
    due_date, amount, description, notes]`. Never send owner fields.
- `components/resources/bank/common/bankErrors.js`: add a `422 → { kind: 'validation',
  code, messages: [error.message] }` branch so 422s show as plain alerts (no Retry).

Specs: verify every route under both `/bank` and `/orgs/5/bank`, the whitelist, and the new 422
branch.

## Files to Change
- `frontend/assets/js/client/TypedAccountsClient.js` — whitelist the three schedule fields
- `frontend/assets/js/client/BillsClient.js` — new bills / bill-payments / undo client
- `frontend/assets/js/components/resources/bank/common/bankErrors.js` — 422 → validation
- `frontend/specs/assets/js/client/TypedAccountsClientSpec.js` — schedule fields pass through
- `frontend/specs/assets/js/client/BillsClientSpec.js` — new
- `frontend/specs/assets/js/components/resources/bank/common/bankErrorsSpec.js` — 422 case
