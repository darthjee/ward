# Split provider — Migration and transition

How the data moves from "one schedule per provider" to "N provider bills", delivered
**expand / contract** so every sub-issue is independently deployable and the shipped frontend
keeps working. Read by [#121](https://github.com/darthjee/ward/issues/121),
[#123](https://github.com/darthjee/ward/issues/123) and
[#125](https://github.com/darthjee/ward/issues/125). Back to the [README](README.md). The target
schema is in [model.md](model.md).

This file supersedes the epic's original single-migration outline.

## Expand migration (#121)

The migration is **not atomic** (MySQL DDL implicitly commits), so it runs three read-only
pre-flight checks first (duplicate provider payments, duplicate backfill descriptions, orphan
payments) and aborts, with ids and dates only in the error, before any DDL. `down` checks each step
before acting, so it tolerates a partially applied `up`. Order:

1. `RENAME TABLE bank_bills TO bank_provider_bills` (preserves ids and the
   `bank_bill_payments.bill_id` FK).
2. Add `kind` (backfill `one_off`) and the nullable recurring group (`charge_frequency`,
   `due_day`, `due_month`, `bills_from`, `show_in_calendar`); make `due_date` nullable.
3. Rename `amount` → `expected_amount`.
4. Add the VIRTUAL `recurring_description` with `UNIQUE (provider_account_id,
   recurring_description)` and the indexes from [model.md](model.md#limits-and-indexes).
5. For every `bank_provider_expense_details` row with `due_day IS NOT NULL`, insert one
   `recurring` bill: `description` = the account's `name`; `expected_amount`, `charge_frequency`,
   `due_day`, `due_month`, `bills_from`, `show_in_calendar` and `paying_account_id` copied.
   Providers without `due_day` get no row, **except** those with past payments: they get a
   hidden recurring bill (`show_in_calendar = false`) so their payments can be repointed. The unique key cannot be violated (one backfilled
   bill per provider; existing one-offs are exempt).
6. Add `bank_bill_payments.provider_bill_id` (nullable, indexed, FK `ON DELETE CASCADE`).
   Repoint rows with `bill_id IS NULL` whose source is a `provider_expense` account to that
   provider's backfilled bill; leave `bill_id NULL`. Debt rows keep both columns `NULL`.
7. Drop and re-add `derived_due_date` narrowed to `IF(bill_id IS NULL AND provider_bill_id IS
   NULL, due_date, NULL)` (VIRTUAL, re-indexed), and add VIRTUAL `provider_bill_due_date` with
   `UNIQUE (provider_bill_id, provider_bill_due_date)`.
8. **Abort, never deduplicate**, if a key cannot be created (e.g. two payments on one
   `(provider_bill_id, due_date)`; impossible today, since there is one bill per account).

The provider schedule columns are **kept**. `bills.json` keeps working (implicitly `one_off`).

## Transition rules (#121 – #124)

- **Write-through (from #121).** A provider-expense create / `PATCH` touching schedule fields
  writes to the provider's single `recurring` bill, creating it when `due_day` is first set, so
  the backfill never goes stale before reads move in #123.
- **Cleared schedule.** Clearing `due_day` hides the bill (`show_in_calendar = false`); it is
  never deleted. The write-through also syncs the bill `description` to the account name.
- **New provider payments (from #121)** get `provider_bill_id` set to the provider's single
  recurring bill; lookup and pre-checks still go by `(source_account_id, due_date, bill_id IS NULL)`.
- **Only while ≤ 1 recurring bill.** The `409 PROVIDER_HAS_MULTIPLE_BILLS` lands in #122, not #121. Once a second recurring bill exists (possible from #122), a
  provider-expense `PATCH` sending any schedule field → `409 PROVIDER_HAS_MULTIPLE_BILLS`; the
  schedule is edited per bill. Non-schedule fields (`name`, `for_accountant`,
  `provider_tax_id`, …) are unaffected.
- **Reads (from #123).** The provider details' schedule fields are **read from the single
  recurring bill**, and are `null` with zero or several.
- **Compatibility aliases (#123).** The account-level provider routes (occurrence payment and
  `bill-payments.json`) resolve to the provider's single recurring bill; with zero or several
  they answer `404`. The alias lookup goes through the same owner-scoped resolver as every other
  bill route.
- **`OccurrenceKind` stays `provider`** for recurring provider-bill occurrences until #125;
  #123 only adds `source_bill`. #124 makes the frontend accept both values.
- The write-through, the `409` and the aliases all disappear in #125.

## Contract migration (#125)

Only after #124 is deployed:

- Drop the seven schedule columns from `bank_provider_expense_details` (`for_accountant` and
  `provider_tax_id` stay).
- Drop the provider schedule DTO fields (sending one → `400`), the compatibility aliases,
  `account-schedule.validator.ts` for providers and the `provider` branch of `billSourceOf`.
- Rename `OccurrenceKind` `provider` → `provider_bill`.

## Rollback

| Migration | `down` | Loss |
|---|---|---|
| Expand (#121) | Delete `recurring` rows, drop the new columns and keys, rename `expected_amount` → `amount` and the table back to `bank_bills`, restore the original `derived_due_date`. | Lossless until #122 ships; **lossy** afterwards (extra bills dropped). |
| Contract (#125) | Re-add the seven columns and backfill from the provider's single recurring bill; `NULL` with zero or several. | **Lossy**, documented as such. |

## Production-dump dry run

Both migrations are dry-run against a production-shaped dump **before merge**; the sub-issue's
author (or the maintainer, for the contract) runs it and records in the PR: provider / bill row
counts (one recurring bill per provider with `due_day`), repointed payment count, the keys
created, the accountant hand-off unchanged, and the `down` round-trip. Because migrations are
out-of-band writers that send no cache-invalidation header, the proxy cache must be reset on
deploy.

## Reference

- [Epic #119](https://github.com/darthjee/ward/issues/119)
- [Feature Specs](https://github.com/darthjee/ward/blob/main/docs/agents/specs.md)
- [`bank-create-bills-migration.spec.ts`](https://github.com/darthjee/ward/blob/main/backend/src/database/tests/bank-create-bills-migration.spec.ts)
- [`20261108120023-bank-create-bills.ts`](https://github.com/darthjee/ward/blob/main/backend/src/database/migrations/20261108120023-bank-create-bills.ts)
- [Caching](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md)

## Required tests

- [#121](https://github.com/darthjee/ward/issues/121): a migration spec following
  `backend/src/database/tests/bank-*-migration.spec.ts` — a provider with `due_day` yields
  exactly one recurring bill with copied fields; one without yields none; past payments are
  repointed with `bill_id NULL`; each of the three keys rejects a duplicate; duplicate one-off
  descriptions migrate unchanged; hidden bills for unscheduled providers with payments; pre-flight
  rejection leaves the schema unchanged; full and partial `down`. Plus `integration/bank-schema.integration-spec.ts`
  and `migrations-round-trip.integration-spec.ts` extensions, and write-through specs (create and
  PATCH, first `due_day` creates the bill).
- [#122](https://github.com/darthjee/ward/issues/122) /
  [#123](https://github.com/darthjee/ward/issues/123): e2e for `PROVIDER_HAS_MULTIPLE_BILLS`,
  schedule fields `null` with zero or several bills, aliases `404` with zero or several.
- [#125](https://github.com/darthjee/ward/issues/125): contract migration spec (columns dropped,
  `down` backfill, lossy cases), `provider-expense-accounts.e2e-spec.ts` (details lose the
  schedule fields; sending one is `400`; `for_accountant` / `provider_tax_id` round-trip),
  `OccurrenceKind` rename.
- `accountant.e2e-spec.ts` must stay green and unchanged across all of them.
