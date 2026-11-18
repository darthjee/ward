# MySQL integration spec

Add `backend/src/database/tests/integration/provider-bills.integration-spec.ts` (new). It runs
against real MySQL through `createTestDataSource()` / `resetDatabase(ds)`, and builds
`ProviderBillService` and its collaborators by hand, as `bill-payments.integration-spec.ts` does.
Use that file's concurrency tests as the template.

Cover:

- **Cap race.** A provider holds 49 recurring bills and two recurring creates run concurrently
  (`Promise.allSettled`). Exactly one succeeds and the other gives `409 PROVIDER_BILL_LIMIT`.
  This proves the provider-row lock.
- **Name race.** Two creates run concurrently with the same description in a different case or
  accents (`"Água"` / `"agua"`). Exactly one gets `409 PROVIDER_BILL_NAME_TAKEN`, never a `500`.
  This proves the `ER_DUP_ENTRY` mapping and confirms the `ai_ci` collation.
- **Cascade.** `DELETE` on a bill with only `skipped` payment rows removes those rows. A bill with
  a `paid` row gives `409` and keeps everything.

If `ENTITIES` / `MIGRATIONS` in `test-data-source.ts` already include `ProviderBill` and the
expand migration (from #121), no harness change is needed.

## Files to Change
- `backend/src/database/tests/integration/provider-bills.integration-spec.ts` (new)
