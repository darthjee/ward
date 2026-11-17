# Write the README and register the active spec

Create the `docs/agents/specs/` folder and `docs/agents/specs/split-provider/README.md`, then
register the feature in the hub.

`README.md` contents:

- **Overview** — one provider, N `ProviderBill` rows of `kind` `recurring` / `one_off`, one
  table `bank_provider_bills` renamed from `bank_bills`; the problem (an ISP billing internet,
  phone and mobile on one CNPJ cannot be modelled today).
- **Product decision** — reverses "No standalone recurring bills — … Decided against, not
  deferred." in `modules/bank/bills.md`; "Recurring bills are derived, never stored" becomes
  "derived from stored `recurring` provider bills"; the permanent docs are rewritten at fold
  time (#126), not now. Include the epic's *Design decisions* table (one table vs two, explicit
  immutable `kind`, schedule on the bill, ledger unchanged, `provider_bill_id` + `bill_id`,
  `bills.json` kept, default paying account per bill, `for_accountant` on the provider,
  expand / contract, `RENAME TABLE`).
- **Scope / Out of scope** — the epic's *Out of scope* list (per-transaction link, #101,
  converting one-offs, debts untouched, no per-bill archiving).
- **Index** — link to every other file in the folder.
- **Sub-issue → file map** — the table from the issue (#121–#126), adjusted if the consultation
  changes which file a sub-issue needs.
- **Delivery** — the expand / contract sequence #121 → #126 with one line per sub-issue and the
  strict dependency chain.
- **Testing** — which sub-issue owns which spec: #121 the migration specs
  (`backend/src/database/tests/bank-*-migration.spec.ts`, `integration/bank-schema.integration-spec.ts`,
  write-through specs); #122 entity / DTO / resolver units and `provider-bills.e2e-spec.ts`,
  `bills.e2e-spec.ts` extension; #123 `occurrences`, `calendar-units`, `bill-history`,
  `bill-payment.writer` units and `bill-payments.e2e-spec.ts` / `calendar.e2e-spec.ts`
  extensions plus the alias specs; #124 frontend Jasmine specs; #125 contract migration spec,
  `provider-expense-accounts.e2e-spec.ts` (schedule field → `400`), `OccurrenceKind` rename;
  `accountant.e2e-spec.ts` stays green unchanged across all of them.
- **`## Future epics`** — three entries, each with what it covers, the decisions it must
  respect and the spec file it comes from: per-transaction bill link (`model.md`); archiving an
  individual bill while keeping its history (`model.md`, `ui/provider-bills.md`); combined
  calendar across owners #101 against the new occurrence shape (`api/payments.md`,
  `ui/calendar.md`).
- **Reference** (epic #119, sub-issues, `specs.md`, `modules/bank/*.md`, `backend/routes/bank.md`
  — GitHub URLs) and **Required tests** (points to the per-file sections / testing map).

In `docs/agents/specs.md`, replace "None." under *Active specs* with an entry for
`split-provider` (link to `specs/split-provider/README.md`, epic #119, one-line summary).

## Files to Change

- `docs/agents/specs/split-provider/README.md` — new.
- `docs/agents/specs.md` — *Active specs*: add `split-provider`.
