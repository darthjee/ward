# Bill history

Add `GET <base>/accounts/:accountId/bill-payments.json` (`user-scoped`), in `bill-payments.controller.ts`.

## Path

- `:accountId` is resolved with `parseId`.
- It must be an owned account of type `debt` or `provider_expense`; otherwise 404 with the identical body.
- **Archived accounts.** Decide whether an archived account's history is visible. The read-only ledger stays readable for archived accounts, so follow the existing ledger route's behaviour for archived accounts, and record the choice.

## Rows

- **Which rows.** Every `bank_bill_payments` row of the account, including off-schedule payments and one-off payments whose `source_account_id` is this provider.
- **Order.** Newest `due_date` first, then `id` DESC.
- **Pagination.** `parsePage` and `buildPagination` (`LEDGER_PER_PAGE` = 50); an invalid page → 400.
- **Envelope.** `{ payments, pagination }`.

## Row shape

Each row is the occurrence's payment shape, plus:

- `due_date` (nominal);
- `bill: {id, description} | null`;
- `off_schedule`: `true` when the row is derived (`bill_id` null) and its `due_date` is not a nominal occurrence of the account's **current** schedule, per `isNominalOccurrence`. One-off rows are never off-schedule.

Spell out the exact field list in the code and in the route docs (step 09).

## Tests

- **Off-schedule after a schedule edit:**
  - pay, then change `due_day`;
  - the payment is kept;
  - it is listed with `off_schedule: true` and is absent from `calendar.json`;
  - it comes back on the calendar (and `off_schedule: false`) when the schedule is changed back.
- **Pagination and invalid page.**
- **404 matrix:** `NOT_FOUND_CASES`, plus a regular / investment account → 404.
- **Responses:** no owner keys; `X-Skip-Cache` is set.

## Files to Change

- `backend/src/bank/bills/bill-payment.service.ts` (or a new `bill-history.service.ts` if the file nears 300 lines) — the history query and `off_schedule`
- `backend/src/bank/bill-payments.controller.ts` — the GET route
- `backend/src/bank/tests/bill-history.spec.ts`, `bill-payments.e2e-spec.ts` — tests
