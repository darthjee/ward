# Backend Plan: Split provider — expand migration for provider bills

Main plan: [plan.md](plan.md)

## Overview
This plan implements the expand migration, the `Bill` → `ProviderBill` rename, the preserved
`bills.json` contract, provider-bill identity for new provider payments, and the provider-expense
write-through. Specs:
[`model.md`](../../specs/split-provider/model.md) and
[`migration.md`](../../specs/split-provider/migration.md), with the issue's corrections (pre-flight,
non-atomic migration, hidden bills, cleared-schedule write-through, no `409` here).

## Context
- Current `bank_bills`: `id`, `provider_account_id` (FK CASCADE), `paying_account_id` (FK SET
  NULL), `due_date` date NOT NULL, `amount` bigint NOT NULL, `description`, `notes`, timestamps.
  Index `idx_bank_bills_provider_due (provider_account_id, due_date)`.
- Current `bank_bill_payments`: `bill_id` (FK `fk_bank_bill_payments_bill_id` CASCADE,
  `uq_bank_bill_payments_bill`). VIRTUAL `derived_due_date = IF(bill_id IS NULL, due_date, NULL)`
  with `uq_bank_bill_payments_derived (source_account_id, derived_due_date)`, created by raw SQL
  in `20261108120023-bank-create-bills.ts`.
- `bank_provider_expense_details` holds the seven schedule columns (`expected_amount`, `due_day`,
  `charge_frequency` NOT NULL default `monthly`, `due_month`, `bills_from`, `show_in_calendar` NOT
  NULL default true, `paying_account_id`). They are all kept.
- Migrations are picked up by glob in `data-source.ts`. The integration suite has an explicit
  `MIGRATIONS` / `ENTITIES` list in `database/tests/integration/test-data-source.ts`, and
  `migrations-registry.integration-spec.ts` enforces it.
- Provider create/PATCH both end in `AccountService#saveWithDetails`. That method calls
  `handler.saveDetails(saved, prepared, manager)` inside a transaction wrapped by
  `mapNameClash`, which is the write-through hook.

## Steps

- [01 — Expand migration with pre-flight and tolerant down](backend/01-expand-migration.md)
- [02 — Rename Bill to ProviderBill and add BillPayment.providerBillId](backend/02-entity-rename.md)
- [03 — Integration specs for the new schema](backend/03-integration-specs.md)
- [04 — Preserve the bills.json contract](backend/04-bills-json-contract.md)
- [05 — Provider-bill identity for new provider payments](backend/05-payment-identity.md)
- [06 — Write-through from provider-expense create/PATCH](backend/06-write-through.md)
- [07 — Spec docs update (architect)](backend/07-docs.md)

## CI Checks
- `backend`: `docker-compose run --rm ward_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm ward_tests yarn test:integration` (CI job: `backend_integration`)
- `backend`: `docker-compose run --rm ward_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm ward_tests yarn build` (CI job: `backend_build`)

## Notes
- All steps ship in **one PR**. Renaming the table and the column breaks the current code on its
  own. Intermediate steps need not compile in isolation.
- **Out of scope:** `409 PROVIDER_HAS_MULTIPLE_BILLS`, `PROVIDER_BILL_LIMIT` and
  `PROVIDER_BILL_NAME_TAKEN` (#122), new routes, reading the schedule from bills or aliases
  (#123), frontend (#124), dropping the schedule columns (#125). `OccurrenceKind` is unchanged.
- **Decision (step 05):** after the migration, unchanged code would write new provider derived
  payments with `provider_bill_id = NULL`. They would land under the narrowed debt key, and
  their uniqueness against repointed rows would be unprotected. The writer therefore sets
  `providerBillId` to the provider's single recurring bill. Lookup and pre-checks still go by
  `(source_account_id, due_date, bill_id IS NULL)`, so Calendar, history and payment responses
  stay byte-identical.
- **Decision (step 06):** the write-through also syncs `description` to the account name, so a
  renamed provider keeps `description = name` while it has only one recurring bill. With a
  single bill this cannot collide on the `recurring_description` key. Otherwise `mapNameClash`
  would misreport such a collision as an account-name `409`.
- `bill.service.ts` (287 lines) and `account.service.ts` (299 lines) are close to the 300-line
  `max-lines` warning. Put the new logic in small collaborators (a bill-field mapper, a
  `ProviderBillWriteThrough` helper) instead of growing those files.
- **PR checklist (the issue requires it):** a production-dump dry run (provider / bill counts incl.
  hidden bills, repointed payment count, keys created, duration, `down` round-trip), and the
  post-deploy reconciliation query (provider schedule columns vs. its single recurring bill).
  Also: deploy at a quiet time and reset the proxy cache. Logs carry ids and dates only.
- `accountant.e2e-spec.ts` stays unchanged and green. `calendar.e2e-spec.ts` and
  `calendar-units.spec.ts` need mechanical edits for the rename only (`ProviderBill`,
  `expectedAmount`, `kind: 'one_off'`). Their assertions do not change.
- No new endpoints and no cache-class changes. The `cache` agent should confirm nothing changes in
  Navi. `security` should review the owner-scoped `kind` filter and the write-through.
