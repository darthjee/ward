# Per-bill pay and undo routes, account-level aliases

Add these routes on both `<base>` paths (`/bank`, `/orgs/:orgId/bank`):

```text
POST   <base>/provider-bills/:id/occurrences/:dueDate/payment.json   201
DELETE <base>/provider-bills/:id/occurrences/:dueDate/payment.json   204
```

The account-level provider routes resolve to the single recurring bill.

- `provider-bill.resolver.ts`: add an `allowArchived` option to `peek` and `resolve`. The default
  stays non-archived. Unknown, foreign, other-context and debt ids still give the uniform `404`.
- New `provider-bill-payment.service.ts`. `bill-payment.service.ts` is already at 208 lines.
  - `pay(owner, id, dueDate, dto)` runs these checks in order:
    1. peek, non-archived (`404`);
    2. strict ISO date and `isProviderBillOccurrence` (`404`);
    3. `paymentCommand` (`400`);
    4. paying account (`422`);
    5. writer (`409`).
    - The target uses `label = bill.description`.
    - Recurring bills use `providerBillId = bill.id, billId = null`.
    - One-offs use `billId = bill.id, providerBillId = null`, the same row and lock as
      `bills/:id/payment.json`.
  - `undo(owner, id, dueDate)`:
    1. resolve with `allowArchived`;
    2. strict ISO date (`404`), with **no** nominal check (#56 rule);
    3. find the payment by `(bill, date)`; for a one-off also require `payment.dueDate === dueDate`;
    4. run the shared #56 checks: no row → `404`; a skip on an archived provider → `404`; a paid
       row with an archived source or paying account → `409 ACCOUNT_ARCHIVED`.
    - Extract the existing `#undo` helper so both services share it.
- `bill-payment.service.ts`:
  - `payOccurrence` and `undoOccurrence` for a **provider** source look up its recurring bills
    (`take: 2`). Exactly one delegates to `ProviderBillPaymentService` with that id. Zero or
    several give the uniform `404`.
  - Undo through the alias must still allow archived providers.
  - Debt routes are unchanged.
  - Remove `#recurringBillId`.
- `payBill` and `undoBill` (`bills/:id/payment.json`) stay, and go through the same writer path
  (bill lock, same row). Paying a one-off through one route and then the other gives `409`. Undo
  works from either route.
- Controller: new `provider-bill-payments.controller.ts` under `@OwnerScopedController('bank')`.
  - Writes use `@CachePolicy(CacheClass.Never)` with owner invalidation, `@StrictBody()
    PayOccurrenceDto`, and `parseId`.
  - Register it in `bank-routes.module.ts`.
  - Wire the service in `bank.module.ts` and `bank-module.loader.ts`.
- Tests in `bill-payments.e2e-spec.ts`, over both base paths:
  - pay and undo per bill for both kinds;
  - the `404` matrix: unknown, foreign, other context, debt id, non-occurrence date, hidden bill,
    before `bills_from`;
  - the archived-provider table (POST `404`; DELETE: skip gives `404`, paid gives
    `409 ACCOUNT_ARCHIVED`);
  - aliases with 0, 1 and several recurring bills;
  - undo of an off-schedule (drifted) payment;
  - a one-off paid through one route then the other gives `409`, with undo from either;
  - cache headers.

## Files to Change
- `backend/src/bank/provider-bill.resolver.ts` — `allowArchived` option
- `backend/src/bank/provider-bill-payment.service.ts` — new per-bill pay and undo service
- `backend/src/bank/bill-payment.service.ts` — aliases delegate, shared undo helper, drop `#recurringBillId`
- `backend/src/bank/provider-bill-payments.controller.ts` — new controller
- `backend/src/bank/bank-routes.module.ts`, `backend/src/bank/bank.module.ts`, `backend/src/bank/bank-module.loader.ts` — wiring
- `backend/src/bank/tests/bill-payments.e2e-spec.ts` — extend
