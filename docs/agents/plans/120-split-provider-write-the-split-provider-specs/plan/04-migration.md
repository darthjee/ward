# Write migration.md

Describe the expand / contract delivery (the epic's single-migration outline is superseded).

- **Expand migration (#121)**, in one transaction: `RENAME TABLE bank_bills TO
  bank_provider_bills`; add `kind` (backfill `one_off`) and the nullable recurring group; make
  `due_date` nullable; rename `amount` → `expected_amount`; add `recurring_description` + its
  unique key and the indexes; insert one `recurring` bill per provider with `due_day IS NOT
  NULL` (description = account name, schedule fields and `paying_account_id` copied); add
  `bank_bill_payments.provider_bill_id`, repoint provider payments (`bill_id IS NULL` and source
  is `provider_expense`), narrow `derived_due_date`, add `provider_bill_due_date` and its key;
  abort (never dedupe) on a duplicate key. Provider schedule columns are **kept**.
- **Transition rules (#121–#124)** — write-through: a provider-expense create / PATCH touching
  schedule fields writes to the single recurring bill (creating it when `due_day` is first set);
  with ≥ 2 recurring bills a schedule field → `409 PROVIDER_HAS_MULTIPLE_BILLS`, non-schedule
  fields unaffected; from #123 the provider details' schedule fields are read from the single
  recurring bill (`null` with zero or several); compatibility aliases (account-level occurrence
  payment and `bill-payments.json` for providers) resolve to the single recurring bill, `404`
  otherwise; `OccurrenceKind` stays `provider` until #125.
- **Contract migration (#125)** — drop the seven columns, the schedule DTO fields (sending one →
  `400`), the aliases, `account-schedule.validator.ts` for providers, the `provider` branch of
  `billSourceOf`; rename `OccurrenceKind` `provider` → `provider_bill`. Only after #124 is
  deployed.
- **Rollback semantics** — expand `down` is real (delete recurring rows, drop new columns/keys,
  rename back, restore original `derived_due_date`): lossless until #122 ships, lossy (extra
  bills dropped) after. Contract `down` re-adds the columns and backfills from the single
  recurring bill, `NULL` with zero / several: lossy, documented.
- **Production-dump dry run** — both migrations dry-run against a production-shaped dump before
  merge; state who runs it and what is checked (row counts, repointed payments, key creation).
- **Reference** and **Required tests** — migration spec(s) following
  `backend/src/database/tests/bank-*-migration.spec.ts` plus
  `integration/bank-schema.integration-spec.ts` / `migrations-round-trip.integration-spec.ts`;
  the cases from the epic's Testing (provider with / without `due_day`, repointing, key
  rejection, duplicate one-off descriptions migrate unchanged); write-through and
  `PROVIDER_HAS_MULTIPLE_BILLS` e2e specs.

## Files to Change

- `docs/agents/specs/split-provider/migration.md` — new.
