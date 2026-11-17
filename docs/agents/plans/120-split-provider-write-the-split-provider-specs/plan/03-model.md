# Write model.md

Transcribe the epic's Proposal and Semantics 1–12 as decisions (table/column descriptions, not
TypeScript).

- **`ProviderBill` entity** — table `bank_provider_bills`; columns, types, nullability; no owner
  column (owner inherited through `provider_account_id`, real FK `ON DELETE CASCADE`);
  timestamps.
- **`kind`** — `recurring` / `one_off`, immutable (`409 PROVIDER_BILL_KIND_LOCKED`), converting
  means delete + create.
- **Column groups and validation matrix** — a table: column × kind → required / optional /
  must be null, with defaults (`charge_frequency` `monthly`, `show_in_calendar` `true`,
  `bills_from` today UTC), `due_month` required only for `yearly`, `expected_amount` optional on
  recurring / required (> 0) on one-off; violations `400` on the merged state.
- **Description uniqueness** — required on both kinds; unique per provider among `recurring`
  only, case-insensitive / accent-sensitive via the column collation, enforced by the VIRTUAL
  generated `recurring_description` + `UNIQUE (provider_account_id, recurring_description)`;
  `409 PROVIDER_BILL_NAME_TAKEN`; existing duplicate one-offs untouched.
- **Provider keeps provider data** — `for_accountant`, `provider_tax_id` stay; the seven schedule
  columns move to the bill (dropped only at contract, #125).
- **Ledger unchanged** — no transaction → bill link.
- **`bank_bill_payments`** — new nullable, indexed, real FK `provider_bill_id`
  (`ON DELETE CASCADE`); the three keys: narrowed `derived_due_date =
  IF(bill_id IS NULL AND provider_bill_id IS NULL, due_date, NULL)` with
  `UNIQUE (source_account_id, derived_due_date)` (debts), new VIRTUAL
  `provider_bill_due_date` with `UNIQUE (provider_bill_id, provider_bill_due_date)`, and
  `UNIQUE (bill_id)` for one-offs; every row under exactly one key; pitfall: generated columns
  stay VIRTUAL and unmapped (MySQL refuses stored generated columns over a cascading FK).
- **Cap** — at most 50 recurring bills per provider (`409 PROVIDER_BILL_LIMIT`), one-offs
  uncapped but paginated.
- **Indexes** — `(provider_account_id, kind, description)`, `(provider_account_id, due_date)`,
  the `provider_bill_id` FK index.
- **Edge cases** relevant to the model (provider archived / deleted, currency change rescales
  every bill, `show_in_calendar: false`, rename keeps history).
- **Reference** and **Required tests** (`provider-bill.entity.spec.ts`,
  `provider-bill.schedule.spec.ts`, `provider-bill-dtos.spec.ts`, the uniqueness / key
  rejection cases in the migration test).

## Files to Change

- `docs/agents/specs/split-provider/model.md` — new.
