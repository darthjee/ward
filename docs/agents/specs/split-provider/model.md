# Split provider — Data model

The `ProviderBill` entity, its `kind` semantics, the payment keys and the limits. Read by
[#121](https://github.com/darthjee/ward/issues/121) (expand migration) and
[#122](https://github.com/darthjee/ward/issues/122) (CRUD API). Back to the
[README](README.md).

## `ProviderBill`

Table `bank_provider_bills`, **renamed** from `bank_bills` (`RENAME TABLE`, so ids and the
`bank_bill_payments.bill_id` FK survive). One row per charge; many rows per provider.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | int PK | no | Preserved from `bank_bills`. |
| `provider_account_id` | int | no | Real FK to `bank_accounts`, `ON DELETE CASCADE`. **No owner column**: the owner is the provider account's. |
| `kind` | varchar(16) | no | `recurring` or `one_off`. Backfilled `one_off` for existing rows. Immutable. |
| `description` | varchar(255) | no | Required on both kinds. |
| `paying_account_id` | int | yes | A non-archived `regular` account of the provider's currency. Per-bill default paying account. |
| `expected_amount` | bigint | yes | Minor units of the provider's currency, `> 0` when set. Renamed from `amount`. |
| `notes` | text | yes | Never exposed in occurrence payloads. |
| `charge_frequency` | varchar(16) | yes | `monthly` / `yearly`. Recurring group. |
| `due_day` | tinyint | yes | Recurring group. |
| `due_month` | tinyint | yes | Recurring group; only for `yearly`. |
| `bills_from` | date | yes | Recurring group. |
| `show_in_calendar` | boolean | yes | Recurring group. |
| `due_date` | date | yes | One-off group (made nullable by the expand migration). |
| `created_at`, `updated_at` | datetime | no | |

> Recurring bills backfilled for unscheduled providers with past payments are **hidden**
> (`show_in_calendar = false`) until a schedule is set.

## `kind`

- `recurring` bills produce derived occurrences through `occurrence-generator.ts`, reused as-is
  (`BillSchedule` already takes the schedule as an argument; one schedule is built per recurring
  bill instead of per account).
- `one_off` bills produce exactly one occurrence, on `due_date`.
- `kind` is **immutable**: a `PATCH` that sends a different value (including `one_off` →
  `recurring`) answers `409 PROVIDER_BILL_KIND_LOCKED`. Converting means delete + create.
  Existing one-off bills are never converted.

### Column groups and validation matrix

Validation runs on the **merged state** (stored row plus the patch), exactly like the current
`charge_frequency` ↔ `due_month` pair rule in `account-types/schedule-fields.ts`. A violation is
`400`; a field of the other group is `400`, never silently ignored.

| Column | `recurring` | `one_off` |
|---|---|---|
| `description` | required | required |
| `expected_amount` | optional (`> 0` when set) | **required** (`> 0`) |
| `paying_account_id` | optional | optional |
| `notes` | optional | optional |
| `charge_frequency` | required, default `monthly` | must be `null` |
| `due_day` | required | must be `null` |
| `due_month` | required only when `yearly`, otherwise `null` | must be `null` |
| `bills_from` | required, default today (UTC) | must be `null` |
| `show_in_calendar` | required, default `true` | must be `null` |
| `due_date` | must be `null` | required |

A recurring bill without `expected_amount` still shows in the Calendar; its Pay dialog then
requires an explicit amount (unchanged from today's provider schedule).

## Description uniqueness

`description` is unique **per provider among `recurring` bills only**, case-insensitive and
accent-insensitive (`utf8mb4_0900_ai_ci` does the folding, so `"Água"` = `"agua"`), mirroring the account-name rule.
Violation: `409 PROVIDER_BILL_NAME_TAKEN`. One-off descriptions may repeat, and a one-off may
share a description with a recurring bill; existing duplicate one-offs migrate unchanged.

Enforced by a **VIRTUAL generated column** `recurring_description = IF(kind = 'recurring',
description, NULL)` with `UNIQUE (provider_account_id, recurring_description)`. The column is not
mapped by the entity.

## What stays on the provider

`bank_provider_expense_details` keeps `for_accountant` and `provider_tax_id` (provider-level
data; `for_accountant` classifies the relationship, not one charge). The seven schedule columns
(`expected_amount`, `charge_frequency`, `due_day`, `due_month`, `bills_from`, `show_in_calendar`,
`paying_account_id`) are **kept by the expand migration** and dropped only by the contract
migration ([#125](https://github.com/darthjee/ward/issues/125)) — see
[migration.md](migration.md). The provider-level default paying account disappears with the
schedule: a single default cannot serve bills with different paying accounts.

## The ledger is unchanged

An account keeps one ledger and one balance. A charge or payment is a plain `Transaction` on the
provider account; **nothing links a transaction to a bill**. The bill is a schedule, not a
sub-ledger, so `account-balances.query.ts`, `ledger.query.ts` and the accountant hand-off stay
untouched (a per-transaction link is a [future epic](README.md#future-epics)).

## `bank_bill_payments` and its three keys

New column `provider_bill_id`: nullable, **indexed**, a **real FK** to `bank_provider_bills`
`ON DELETE CASCADE`. It is set for payments of recurring provider bills; `bill_id` is kept for
one-offs. Every payment row falls under exactly one unique key:

| Payments of | Identity | Key |
|---|---|---|
| Debt occurrences | `(source_account_id, due_date)` | `UNIQUE (source_account_id, derived_due_date)`, where `derived_due_date` is **narrowed** to `IF(bill_id IS NULL AND provider_bill_id IS NULL, due_date, NULL)` |
| Recurring provider bills | `(provider_bill_id, due_date)` | `UNIQUE (provider_bill_id, provider_bill_due_date)`, where `provider_bill_due_date = IF(provider_bill_id IS NOT NULL, due_date, NULL)` |
| One-off bills | `(bill_id)` | `UNIQUE (bill_id)` (existing) |

Narrowing the debt key is required: repointed provider payments keep `bill_id NULL`, so without
it the old debt key would still cover them and reject two bills of one provider paid on the same
date.

**Pitfall.** Both generated columns (`derived_due_date`, `provider_bill_due_date`) must stay
**VIRTUAL** and **unmapped** by the entity (TypeORM never writes them). MySQL refuses a STORED
generated column over a cascading FK, as `20261108120023-bank-create-bills.ts` already documents.
`bank_bill_payments.due_date` remains the real, mapped column.

## Limits and indexes

- **Cap**: at most **50 recurring bills per provider** → `409 PROVIDER_BILL_LIMIT` (bounds the
  Calendar series one provider adds). One-offs are uncapped but paginated.
- **Indexes**: `(provider_account_id, kind, description)` serves the list, the calendar source
  query and the uniqueness lookup; `(provider_account_id, due_date)` stays for one-offs; history
  by bill uses the `provider_bill_id` FK index.

## Edge cases pinned by the model

- **Provider archived**: its bills leave the Calendar; the list, the single `GET` and the
  per-bill history stay readable; `PATCH` / `DELETE` on them answer `404`; they return to the
  Calendar on unarchive.
- **Provider deleted**: bills cascade, and their payment rows cascade through the bill.
- **Currency change on the provider** (only before any transaction): rescales every bill's
  `expected_amount`; an amount not representable in the new exponent → `400` and the whole PATCH
  fails.
- **`show_in_calendar: false`**: no occurrence, but the bill stays editable and keeps its history.
- **Renaming a recurring bill**: only labels change; payment identity is `provider_bill_id`, so
  history is kept.
- **No per-bill archiving**: `ProviderBill` has no `archived` column; a bill leaves the list and
  Calendar only with its provider. To stop one bill, delete it (when it has no paid payment) or
  set `show_in_calendar: false`.

## Reference

- [Epic #119 — Refactor providers](https://github.com/darthjee/ward/issues/119)
- [Feature Specs](https://github.com/darthjee/ward/blob/main/docs/agents/specs.md)
- [Bank — Bills](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/bills.md)
- [Bank — Provider-expense accounts](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/provider-expense.md)
- [`bill.entity.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/entities/bill.entity.ts)
- [`provider-expense-details.entity.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/entities/provider-expense-details.entity.ts)
- [`occurrence-generator.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/occurrence-generator.ts)
- [`20261108120023-bank-create-bills.ts`](https://github.com/darthjee/ward/blob/main/backend/src/database/migrations/20261108120023-bank-create-bills.ts)

## Required tests

Owned by [#122](https://github.com/darthjee/ward/issues/122) unless noted.

- `provider-bill.entity.spec.ts` (new) — `kind` immutability at the entity level, both column
  groups, the nullability matrix.
- `provider-bill.schedule.spec.ts` (new) — one `BillSchedule` per recurring bill; `one_off` never
  produces a schedule; the `bills_from` / `show_in_calendar` defaults.
- `provider-bill-dtos.spec.ts` (new) — every `400` of the validation matrix on create and on the
  merged PATCH state; a `kind` change is `409`, not `400`.
- [#121](https://github.com/darthjee/ward/issues/121): the migration test cases for the three
  payment keys (duplicate rejection on each key, duplicate one-off descriptions migrate
  unchanged, VIRTUAL unmapped generated columns).
