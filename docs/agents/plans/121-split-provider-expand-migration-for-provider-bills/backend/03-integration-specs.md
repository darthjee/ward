# Integration specs for the new schema

Register the migration and the entity, then cover the real MySQL behaviour.

- In `database/tests/integration/test-data-source.ts`, add `BankExpandProviderBills20261117120025`
  to `MIGRATIONS`, and swap `Bill` → `ProviderBill` in `ENTITIES`.
- `bank-schema.integration-spec.ts`:
  - Rename the `bank_bills` describe to `bank_provider_bills`. Check the columns: `kind` NOT
    NULL, the recurring group nullable, `due_date` and `expected_amount` nullable. Check the
    indexes and `uq_bank_provider_bills_recurring_description` (a duplicate recurring
    description is rejected; duplicate one-offs and a one-off sharing a recurring description
    are allowed). Check `insertBill` with `expected_amount`.
  - `bank_bill_payments`: `provider_bill_id` with an index and a cascade FK. Each of the three
    keys rejects a duplicate. The narrowed debt key no longer covers provider-bill rows.
    Deleting a provider bill cascades to its payments.
  - **New `expand backfill` describe:** `runMigrationsUpTo(ds, 'AuthAddUsersLocale20261113120024')`,
    seed, then `ds.runMigrations()`. The cases:
    - A scheduled provider gets one recurring bill with copied fields and `description = name`.
    - An unscheduled provider without payments gets none.
    - An unscheduled provider with payments gets one hidden bill (`show_in_calendar = false`,
      `due_day` / `due_month` from the latest payment, `bills_from` = earliest payment when
      null, frequency default `monthly`).
    - Archived providers are backfilled.
    - Provider payments are repointed and keep `bill_id NULL`, including off-schedule dates.
    - Debt payments keep both ids NULL.
    - Duplicate one-off descriptions migrate unchanged, and one-off ids are preserved.
  - **Pre-flight:** seed two provider payments on the same `(source, due_date)` (possible
    before this migration only through the derived key when one row has a `bill_id`; otherwise
    insert after temporarily dropping the key in the seed). Expect `runMigrations` to reject with
    a message of ids and dates only, and the schema to be unchanged (`bank_bills` still exists,
    no `kind`).
  - **`down`:** the full-`up` round-trip restores the original columns and keys, deletes the
    recurring rows, and restores the one-offs with `amount`. A partial `up` (run the rename and
    column statements by hand from the exported constants, then call the migration's `down`
    directly) is restored too.
  - Update the existing `down` sequence test for the extra `undoLastMigration()`.
- `migrations-round-trip.integration-spec.ts`: the expected `bank_` table list gets
  `bank_provider_bills` instead of `bank_bills`.
- `bill-payments.integration-spec.ts`, `bills-calendar.integration-spec.ts`: `ProviderBill`,
  `expectedAmount`, `kind: 'one_off'`.

## Files to Change
- `backend/src/database/tests/integration/test-data-source.ts` — registry lists.
- `backend/src/database/tests/integration/bank-schema.integration-spec.ts` — schema, backfill, pre-flight and `down` cases.
- `backend/src/database/tests/integration/migrations-round-trip.integration-spec.ts` — table list.
- `backend/src/database/tests/integration/bill-payments.integration-spec.ts`, `bills-calendar.integration-spec.ts` — rename.
