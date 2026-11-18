# Occurrence payload and calendar per bill

Build calendar and overdue occurrences per recurring bill, and add `source_bill` to the payload.

- `occurrence-response.ts`:
  - add `sourceBill` to `OccurrenceInput`, and `source_bill: { id, description } | null` to
    `OccurrenceResponse`:
    - set from `source.bill` for recurring provider bills;
    - set from the one-off bill in `billInput`;
    - `null` for debts.
  - Use an explicit mapper. Never spread the entity, so `notes` is never included.
  - `compareOccurrences`: effective date → kind → `source_bill?.id` → `source_account.id` →
    `bill?.id`.
  - `kind` stays `'provider'` for recurring provider-bill occurrences.
- `calendar.query.ts`:
  - `sources(owner)`: debt sources stay as they are.
  - Provider sources come from **one** query:
    `ProviderBill { providerAccountId IN (owner's non-archived provider ids), kind: 'recurring' }`.
    - Map each bill through `billSourceOfProviderBill`.
    - Keep only active schedules (`dueDay !== null && showInCalendar`).
    - Load paying refs in one batch through the existing `refs()`.
  - `payments(...)` gets three branches:
    - debt `{ sourceAccountId IN debtIds, billId IS NULL, providerBillId IS NULL, dueDate }`;
    - `{ providerBillId IN recurringBillIds, dueDate }`;
    - one-off `{ billId IN }`.
  - Orphan rows (`providerBillId IS NULL` on a provider source) are no longer matched.
- `calendar.service.ts`:
  - Payment map key:
    - `${providerBillId}:${nominal}` for rows and sources with a provider bill;
    - `${sourceAccountId}:${nominal}` for debts;
    - one-offs unchanged.
  - Add the 1000-occurrence cap on the total count (see backend.md Notes): `calendar` answers
    `400 VALIDATION_FAILED` over the cap, and `overdue` is cut to 1000 after sorting.
- Tests:
  - `occurrences.spec.ts`:
    - `source_bill` for each kind;
    - comparator tie-break;
    - two bills of one provider on the same date stay distinct.
  - `calendar-units.spec.ts`:
    - one series per bill;
    - payment matched per bill;
    - an orphan is ignored;
    - the 1000 cap.
  - `calendar.e2e-spec.ts`:
    - a provider with two recurring bills;
    - overdue lists each bill independently;
    - existing cases stay green with only `source_bill` added.

## Files to Change
- `backend/src/bank/occurrence-response.ts` — `source_bill`, comparator
- `backend/src/bank/calendar.query.ts` — one recurring-bill query, three-branch payment lookup
- `backend/src/bank/calendar.service.ts` — map key, occurrence cap
- `backend/src/bank/tests/occurrences.spec.ts` — extend
- `backend/src/bank/tests/calendar-units.spec.ts` — extend
- `backend/src/bank/tests/calendar.e2e-spec.ts` — extend
