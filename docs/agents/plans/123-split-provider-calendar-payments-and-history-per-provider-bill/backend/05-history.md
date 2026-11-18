# Per-bill and account-wide history

Add `GET <base>/provider-bills/:id/bill-payments.json?page=`. It inherits the user-scoped cache
class.

Keep `GET <base>/accounts/:accountId/bill-payments.json` account-wide. It is **not** an alias.

- `bill-history.service.ts`:
  - `historyForBill(owner, id, page)`:
    - resolve with `allowArchived` (an archived provider gives `200`);
    - recurring bills page `{ providerBillId }` and one-offs page `{ billId }`;
    - newest `due_date` first, then newest id; 50 per page;
    - recurring bills read through the `(provider_bill_id, due_date)` unique index.
  - `history(owner, accountId, page)` keeps `{ sourceAccountId }`. That covers every bill's
    payments plus orphans, with zero or several recurring bills and on an archived provider.
  - Batch-load bills for both `billId` and `providerBillId` in one query each, so there is no
    N+1.
  - Row shape:
    - `bill: { id, description } | null` keeps its meaning (one-offs only);
    - new `source_bill: { id, description } | null` is set on every provider-bill row (both
      kinds), and `null` for debt and orphan rows;
    - explicit mapping, so `notes` never appears.
  - `off_schedule` per row:
    - a recurring provider-bill row is checked against **that bill's** schedule (forced
      `archived: false, showInCalendar: true` as `onSchedule` does today);
    - one-offs give `false`;
    - debts and orphans are checked against the details-row schedule.
- Controller: add the GET to `provider-bill-payments.controller.ts` (step 04), using `parseId`
  and `parsePage`.
- Tests:
  - `bill-history.spec.ts`:
    - zero, one and several recurring bills plus one-offs;
    - per-bill `off_schedule` (editing bill A never flags bill B's rows);
    - `source_bill` presence and absence;
    - orphans.
  - `bill-payments.e2e-spec.ts`:
    - per-bill history on both base paths, including an archived provider and the `404` matrix;
    - the existing account-history cases pass unchanged except for the added `source_bill`.

## Files to Change
- `backend/src/bank/bill-history.service.ts` — per-bill history, `source_bill`, per-row `off_schedule`
- `backend/src/bank/provider-bill-payments.controller.ts` — GET route
- `backend/src/bank/tests/bill-history.spec.ts` — extend
- `backend/src/bank/tests/bill-payments.e2e-spec.ts` — extend
