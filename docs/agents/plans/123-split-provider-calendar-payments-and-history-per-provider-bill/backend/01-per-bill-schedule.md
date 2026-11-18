# Per-bill schedule

Add pure helpers that turn a `ProviderBill` into a schedule, so that every later step shares one
definition of "occurrence of this bill". `occurrence-generator.ts` stays unchanged.

- New `provider-bill.schedule.ts`:
  - `providerBillSchedule(bill, provider): BillSchedule | null`:
    - `null` for one-offs;
    - narrows `chargeFrequency` (`string | null`) to `'monthly' | 'yearly'`, defaulting to
      `monthly`;
    - uses `showInCalendar ?? true`;
    - takes `archived` from `provider.archivedAt`.
  - `isProviderBillOccurrence(bill, provider, date): boolean`:
    - requires a strict `YYYY-MM-DD` date;
    - recurring bills use `isNominalOccurrence` on the bill's schedule, which is O(1) and false
      for inactive, hidden or archived schedules and before `bills_from`;
    - one-offs check equality with `due_date`.
- `bill-schedule.ts`:
  - add `bill: ProviderBill | null` to `BillSource`; `billSourceOf` sets `null`;
  - add `billSourceOfProviderBill(bill, provider, defaultPayingRef)`, which returns a
    `BillSource` with `kind: 'provider'`, `expected = bill.expectedAmount` and the bill's paying
    account as default.
- Tests in a new `tests/provider-bill.schedule.spec.ts`:
  - monthly and yearly bills;
  - hidden bills, bills before `bills_from` and archived providers;
  - a null `due_day`;
  - one-off equality;
  - impossible dates.

## Files to Change
- `backend/src/bank/provider-bill.schedule.ts` — new: `providerBillSchedule`, `isProviderBillOccurrence`
- `backend/src/bank/bill-schedule.ts` — `BillSource.bill`, `billSourceOfProviderBill`
- `backend/src/bank/tests/provider-bill.schedule.spec.ts` — new spec
