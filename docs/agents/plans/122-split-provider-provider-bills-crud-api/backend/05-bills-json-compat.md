# bills.json compatibility changes

`bills.json` stays a one-off-only projection that uses `amount`, with these deliberate changes:

- **Responses** include `kind: 'one_off'`. Add it to `BillResponse` / `serializeBill`.
- **`POST bills.json`** creates with `kind = 'one_off'`. A recurring field in the body
  (`charge_frequency`, `due_day`, `due_month`, `bills_from`, `show_in_calendar`, `kind`) gives
  `400`. `@StrictBody()` already gives this if the fields are absent from `CreateBillDto`; assert it.
- **`GET`, `PATCH` and `DELETE bills/:id.json`** on a recurring id give the uniform `404`
  (already true through the `kind: 'one_off'` filter; assert it).
- **`PATCH bills/:id.json` move rules (correctness fix).**
  - A target in another currency gives `422 CURRENCY_MISMATCH`. The amount is no longer
    rescaled.
  - An archived target gives `409 ACCOUNT_ARCHIVED`.
  - An unknown or foreign target keeps today's `422 ACCOUNT_NOT_FOUND`.
  - A paid one-off keeps `409 BILL_PAID`.
  - The error body shape is unchanged.

**Tests.** Extend `backend/src/bank/tests/bills.e2e-spec.ts`:

- Only `one_off` bills are listed, even when the provider has recurring bills.
- `kind` is `'one_off'` in responses, and in the stored row on create.
- A recurring field in the body gives `400`.
- A recurring id gives `404` on every verb.
- Rewrite the existing "re-checks the paying account currency when the provider changes" case,
  which today expects a `200` move to a USD provider, to expect `422 CURRENCY_MISMATCH`.
- Add the archived-target `409`.
- A one-off created through `bills.json` is visible through `provider-bills`, and the reverse.

## Files to Change
- `backend/src/bank/bill-response.ts` — add `kind`.
- `backend/src/bank/bill.service.ts` — move rules (shared with step 03).
- `backend/src/bank/tests/bills.e2e-spec.ts` — extend and rewrite the cases above.
