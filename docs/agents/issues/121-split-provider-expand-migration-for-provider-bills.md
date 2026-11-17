# Issue: Split provider — expand migration for provider bills

## Description

Sub-issue of epic [#119 — Refactor providers](https://github.com/darthjee/ward/issues/119).
The **expand** step: introduce `bank_provider_bills` and per-bill payment identity next to the
existing provider schedule, without removing anything, so every later step is independently
deployable. Builds against `docs/agents/specs/split-provider/model.md` and `migration.md`.

## Problem

A `provider_expense` account stores exactly one recurring schedule in
`bank_provider_expense_details`, and `bank_bills` stores only one-off bills, so a provider that
bills several services cannot be modelled. The new model must land in the database before the
API, Calendar and UI can use it, but the shipped code and frontend must keep working unchanged.

## Expected Behavior

- One migration (with a real, tested, partial-state-tolerant `down` and a pre-flight that runs
  before any DDL — see **Backward Compatibility**):
  0. Pre-flight (read-only; throws before any DDL — see **Backward Compatibility**).
  1. `RENAME TABLE bank_bills TO bank_provider_bills` (ids and the `bank_bill_payments.bill_id`
     FK preserved).
  2. Add `kind` (backfill `'one_off'`), `charge_frequency`, `due_day`, `due_month`,
     `bills_from`, `show_in_calendar`; make `due_date` nullable; rename `amount` →
     `expected_amount` (nullable for recurring).
  3. Insert one `kind = 'recurring'` bill per provider with `due_day IS NOT NULL`, copying its
     schedule and `paying_account_id`, `description` = account name — plus a hidden one for
     providers without `due_day` that have past payments (see **Edge Cases**). Archived
     providers included.
  4. Add `bank_bill_payments.provider_bill_id` (real FK, `ON DELETE CASCADE`, indexed) and
     repoint every provider payment with `bill_id IS NULL` to the new bill.
  5. Redefine `derived_due_date` as `IF(bill_id IS NULL AND provider_bill_id IS NULL, due_date, NULL)`
     (VIRTUAL, re-indexed with `source_account_id`); add VIRTUAL
     `provider_bill_due_date = IF(provider_bill_id IS NOT NULL, due_date, NULL)` with
     `UNIQUE (provider_bill_id, provider_bill_due_date)`; keep `UNIQUE (bill_id)`.
  6. Add VIRTUAL `recurring_description = IF(kind = 'recurring', description, NULL)` with
     `UNIQUE (provider_account_id, recurring_description)`, and index
     `(provider_account_id, kind, description)`.
  - Aborts (no dedup), in the pre-flight before any DDL, if step 4 would produce a duplicate
    `(provider_bill_id, due_date)`.
- The seven schedule columns of `bank_provider_expense_details` are **kept**.
- `Bill` entity becomes `ProviderBill` (`entities/provider-bill.entity.ts`); generated columns
  stay unmapped. `BillPayment` gains `providerBillId`.
- `bills.json` and `/bills/:id.json` behave as before, filtering `kind = 'one_off'` implicitly;
  a recurring field in their bodies → `400`. Their request and response keep the field name
  `amount` (mapped to `expected_amount`), so the shipped frontend keeps working.
- **Write-through**: a provider-expense create / PATCH that sets schedule fields updates the
  provider's single recurring bill (creating it when `due_day` is first set). The
  `409 PROVIDER_HAS_MULTIPLE_BILLS` guard for two or more recurring bills is **not** part of this
  issue — it moves to #122, the first issue where a second recurring bill can exist.
- Calendar, overdue, payment and history behaviour is byte-identical to before.

## Scope

**In scope** — these ship together, because renaming the table and the column breaks the
current code otherwise:

1. **Schema**: the expand migration, its `down`, the migration spec and the integration specs.
2. **Entity rename**: `Bill` → `ProviderBill` (`entities/provider-bill.entity.ts`) across the
   bank module (`bill.service`, `bill-payment.writer`, `bill-history.service`,
   `calendar.service`/`calendar.query`, `occurrence-response`, `bill-response`, test support),
   plus `BillPayment.providerBillId`.
3. **`bills.json` contract preservation**: implicit `kind = 'one_off'` filter, `400` on
   recurring fields, `amount` ↔ `expected_amount` mapping.
4. **Write-through** from provider-expense create / PATCH into the single recurring bill, so the
   backfill never goes stale before reads move in #123.

**Out of scope**:

- `409 PROVIDER_HAS_MULTIPLE_BILLS` — moved to #122, where it first becomes reachable (no
  untestable branch here).
- New routes: provider-bill CRUD (#122), reading schedule from bills / compatibility aliases
  (#123), any frontend change (#124).
- Calendar / occurrence changes: they keep reading the provider schedule columns;
  `OccurrenceKind` is unchanged.
- Dropping the seven schedule columns of `bank_provider_expense_details` (#125).
- API-level `PROVIDER_BILL_LIMIT` (50-bill cap) and `PROVIDER_BILL_NAME_TAKEN` errors (#122).
  The DB unique key on `(provider_account_id, recurring_description)` is still created here.

`docs/agents/specs/split-provider/migration.md` ("Transition rules") must be updated in the same
PR to say the `409` lands in #122.

## Edge Cases

Grounded in today's code: `account-types/schedule-fields.ts` lets a provider-expense PATCH clear
`due_day` (keeping `bills_from`), and `bill-history.service.ts` keeps showing the earlier
payments flagged `off_schedule`. Bill sources (`bill-source.resolver.ts`) include archived
accounts. So the following states exist in production and must be handled:

1. **Provider without `due_day` but with past payments** (schedule cleared after being paid).
   The backfill also creates a recurring bill for every provider with `due_day IS NULL` that has
   at least one `bank_bill_payments` row with `bill_id IS NULL`:
   - `show_in_calendar = false` (it never shows in the Calendar);
   - `due_day` (and, for `yearly`, `due_month`) derived from the **most recent** such payment's
     `due_date`; `charge_frequency` copied from the provider, defaulting to `monthly`;
     `bills_from` copied, defaulting to the earliest such payment's `due_date`;
   - `description` = account name, `expected_amount` / `paying_account_id` copied;
   - its payments are repointed like any other.
   This keeps `model.md`'s validation matrix intact (`due_day` stays required on recurring bills)
   and leaves no provider payment under the debt key. Providers with neither `due_day` nor
   payments still get no bill.
2. **Write-through when the schedule is cleared.** A provider-expense PATCH that sets
   `due_day: null` does **not** delete the recurring bill (that would cascade-delete its payment
   history). It sets `show_in_calendar = false` and keeps the bill's last `due_day` /
   `due_month`. Setting `due_day` again later updates the same bill (and restores
   `show_in_calendar` from the request or the provider), so history stays continuous. *Follow-up
   for #123:* once provider details read the schedule from the bill, a hidden bill must not make
   a cleared schedule reappear. #123 must decide how it surfaces this (e.g. read `due_day` as
   `null` while the bill is hidden by a cleared schedule).
3. **Archived providers** are backfilled and their payments repointed exactly like active ones,
   regardless of `archived_at`, so their bills and history return on unarchive.
4. **Off-schedule payments** (dates that no longer match the provider's current pattern) are
   repointed unchanged; identity is `(provider_bill_id, due_date)` only.
5. **Debt accounts** are untouched: their payments keep `bill_id` and `provider_bill_id` `NULL`
   and stay under the narrowed debt key.

## Backward Compatibility

### The migration is not atomic

Migrations run through the TypeORM CLI (`migration:run:prod`), whose default transaction mode
wraps each migration in a transaction — but MySQL implicitly commits on every `RENAME TABLE`,
`ALTER TABLE` and index creation, so that transaction protects nothing. The spec's "one
transaction" wording is wrong and must be corrected in `migration.md` in the same PR. A failure
midway leaves a half-migrated schema that TypeORM has not recorded, and a re-run would break on the
`RENAME`. Therefore:

- **Pre-flight first.** `up()` starts with read-only checks that throw **before any DDL** when
  any key could fail, with a message naming the offending rows:
  - two provider payments (`bill_id IS NULL`, provider source) on the same
    `(source_account_id, due_date)` — they would collide on
    `UNIQUE (provider_bill_id, provider_bill_due_date)`;
  - two backfilled recurring bills with the same `(provider_account_id, description)` (cannot
    happen with one bill per provider, checked anyway);
  - any provider payment that the backfill would leave without a bill.
  "Abort, never deduplicate" is implemented by this pre-flight, not by a failing `ADD UNIQUE`.
- **Tolerant `down()`.** Every step checks that something exists before undoing it (`DROP ... IF
  EXISTS`, column/index existence checks via `queryRunner.hasColumn` / `getTable`), so `down`
  can also undo a **partial** `up`. Order: drop the new keys and generated columns, restore the
  original `derived_due_date`, drop `provider_bill_id`, delete `recurring` rows, drop the
  recurring columns and `kind`, rename `expected_amount` → `amount`, restore `due_date NOT
  NULL`, rename the table back.
- Tests cover a `down` run from a partially applied `up` (e.g. stopped after the rename and
  column changes).

### Deploy window

The table and column renames break the **old backend code**. Between the migration running and
the new instance going live, `bills.json`, the Calendar and payments may answer `500`, and a
provider-expense PATCH served by the old code skips the write-through. This is **accepted**:
Ward runs a single instance on the free tier, so the window is the length of the switch-over.
Mitigations, recorded in the PR:

- deploy at a quiet time;
- after deploy, run a reconciliation query (provider schedule columns vs. its single recurring
  bill) and report the result in the PR; any drift is fixed by re-saving the provider;
- reset the proxy cache (migrations send no invalidation header).

No compatibility VIEW and no maintenance mode.

### What stays compatible

- **Shipped frontend**: unchanged. `bills.json` / `/bills/:id.json` keep their request and
  response shapes (`amount`, one-offs only), and provider-expense responses still come from the
  provider's schedule columns.
- **Calendar, overdue, payment, history and accountant hand-off**: byte-identical;
  `accountant.e2e-spec.ts` stays green and unchanged.
- **Rollback**: `down` is lossless until #122 ships (it then drops any extra bills).

## Performance & Security

### Performance

- **Set-based data moves.** The backfill and the payment repoint are single `INSERT … SELECT`
  and `UPDATE … JOIN` statements, with no row-by-row loop in Node, so memory stays flat (Render
  free tier, 512 MB).
- **Pre-flight** is a few `GROUP BY … HAVING COUNT(*) > 1` / anti-join queries on already
  indexed columns.
- **DDL cost.** On InnoDB, nullable columns and VIRTUAL generated columns are added `INSTANT` /
  `INPLACE`; the `provider_bill_id` FK and the new indexes are `INPLACE`. At Ward's data volume,
  locks last seconds. The production-dump dry run records the migration's duration in the PR.

### Security

- **Legacy routes hide recurring bills behind a uniform `404`.** `GET` / `PATCH` / `DELETE
  /bills/:id.json` on a `recurring` provider bill answer the same `404` as an unknown or foreign
  id. The `kind = 'one_off'` filter lives inside the owner-scoped query (not a check after
  loading), so a recurring bill cannot be told apart from one that doesn't exist. This also
  prevents a legacy `DELETE` from cascade-deleting a recurring bill's payment history. The list
  `bills.json` never returns recurring bills. Covered by e2e specs (GET / PATCH / DELETE on a
  backfilled recurring id → `404`).
- **Ownership.** `bank_provider_bills` has no owner column; every access, including the
  write-through, goes through the provider account's owner scope, exactly as `bill-source.resolver`
  does today. The write-through only ever touches the bill of the provider being saved.
- **Copied references.** The backfill copies `paying_account_id` from the provider as-is; it was
  validated (same owner, `regular`, provider currency) when it was set, so no new
  cross-owner reference can appear.
- **Logs carry ids and dates only.** Pre-flight abort messages and migration logs include
  account ids, payment ids and `due_date` values, never descriptions, amounts, account names or
  tax ids. Migration logs go to Render and into the PR's dry-run report.

## Solution

Owned by the `backend` agent. Follow the existing migration pattern
(`backend/src/database/migrations/20261108120023-bank-create-bills.ts` for generated columns
added with raw `ALTER TABLE`, VIRTUAL because of the cascading FK) and test convention
(`backend/src/database/tests/bank-*-migration.spec.ts` plus
`integration/bank-schema.integration-spec.ts`). Required tests:

- **Migration spec** (`bank-*-migration.spec.ts` pattern): a scheduled provider yields one
  recurring bill with copied fields; an unscheduled provider with no payments yields none; an
  unscheduled provider **with** past payments yields one hidden bill (`show_in_calendar = false`,
  `due_day` / `due_month` from the latest payment); archived providers are backfilled; past
  payments repoint with `bill_id NULL`; debt payments are untouched; duplicate one-off
  descriptions migrate unchanged; each of the three unique keys rejects a duplicate; the
  pre-flight aborts before any DDL (schema unchanged) and its message carries ids/dates only;
  `down` restores the original schema, both after a full `up` and after a partial one.
- **Integration**: `integration/bank-schema.integration-spec.ts` and
  `migrations-round-trip.integration-spec.ts` extended.
- **Write-through specs**: create and PATCH update the single recurring bill; the first
  `due_day` creates it; `due_day: null` hides it (keeps the bill and its last `due_day`);
  setting `due_day` again reuses the same bill.
- **Legacy routes e2e**: `bills.json` lists one-offs only with `amount`; a recurring field in a
  body → `400`; GET / PATCH / DELETE `/bills/:id.json` on a recurring id → `404`.
- `accountant.e2e-spec.ts` and the Calendar / history specs stay green and unchanged.
- **Production-dump dry run** before merge, recorded in the PR: provider / bill counts (incl.
  hidden bills), repointed payment count, keys created, duration, `down` round-trip, and the
  post-deploy reconciliation query.

Update `docs/agents/specs/split-provider/migration.md` (and `model.md` where touched) in the same
PR: the "one transaction" wording, the pre-flight, the hidden-bill backfill, the cleared-schedule
write-through, and the `409` moving to #122.
