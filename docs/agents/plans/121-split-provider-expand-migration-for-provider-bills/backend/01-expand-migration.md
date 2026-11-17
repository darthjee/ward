# Expand migration with pre-flight and tolerant down

Create `backend/src/database/migrations/20261117120025-bank-expand-provider-bills.ts`, class
`BankExpandProviderBills20261117120025`. The timestamp must be after `20261113120024`, and the
class name must end with the file's timestamp (the registry spec checks this). Follow the
raw-SQL generated-column pattern of `20261108120023-bank-create-bills.ts`. Export the SQL
constants so the spec can assert them.

MySQL implicitly commits every DDL statement, so the TypeORM transaction protects nothing. The
order is what makes the migration safe.

## `up()`

0. **Pre-flight (read-only, before any DDL).** Each check throws an `Error` whose message lists
   only ids and dates (never descriptions, amounts, names or tax ids):
   - Duplicate provider payments: `bank_bill_payments` with `bill_id IS NULL` whose
     `source_account_id` is a `provider_expense` account, `GROUP BY source_account_id, due_date
     HAVING COUNT(*) > 1`.
   - Duplicate backfill descriptions per provider: group the would-be recurring rows by
     `(account id, name)`. This cannot happen today but is checked anyway.
   - Orphan payments: provider payments with `bill_id IS NULL` whose provider would get no bill
     under the backfill rules. Use an anti-join that mirrors the backfill predicate. It should
     be empty by construction.
1. `RENAME TABLE bank_bills TO bank_provider_bills`. The FK `fk_bank_bill_payments_bill_id`
   follows the table.
2. `ALTER TABLE bank_provider_bills`:
   - add `kind varchar(16) NOT NULL DEFAULT 'one_off'` (this backfills existing rows), then drop
     the default or keep it (decide; the entity always sets it);
   - add nullable `charge_frequency varchar(16)`, `due_day tinyint`, `due_month tinyint`,
     `bills_from date`, `show_in_calendar boolean`;
   - make `due_date` nullable, and `RENAME COLUMN amount TO expected_amount` made nullable.
3. **Backfill**, as one set-based `INSERT … SELECT` per source (no Node loops):
   - **Scheduled providers:** every `bank_provider_expense_details` with `due_day IS NOT NULL`,
     joined to `bank_accounts` (archived included). Insert `kind='recurring'`,
     `description = a.name`, and copy `expected_amount`, `charge_frequency`, `due_day`,
     `due_month`, `bills_from`, `show_in_calendar` and `paying_account_id`.
   - **Hidden bills:** providers with `due_day IS NULL` that have at least one payment with
     `bill_id IS NULL`. Insert `show_in_calendar = false`, with:
     - `due_day = DAY(latest payment due_date)`;
     - `due_month = MONTH(latest)` only when `charge_frequency = 'yearly'`;
     - `charge_frequency = COALESCE(provider value, 'monthly')`;
     - `bills_from = COALESCE(provider bills_from, MIN(payment due_date))`;
     - `description`, `expected_amount` and `paying_account_id` copied as above.
4. `ALTER TABLE bank_bill_payments ADD COLUMN provider_bill_id int NULL`, plus the index and FK
   `fk_bank_bill_payments_provider_bill_id` → `bank_provider_bills(id)` `ON DELETE CASCADE`.
   Then `UPDATE bank_bill_payments p JOIN bank_provider_bills b ON b.provider_account_id =
   p.source_account_id AND b.kind = 'recurring' SET p.provider_bill_id = b.id WHERE p.bill_id
   IS NULL`. Debt sources have no bill, so their rows are untouched.
5. Drop `uq_bank_bill_payments_derived`, then the `derived_due_date` column. Re-add it VIRTUAL as
   `IF(bill_id IS NULL AND provider_bill_id IS NULL, due_date, NULL)`, with the unique index
   `uq_bank_bill_payments_derived (source_account_id, derived_due_date)`.
   Add VIRTUAL `provider_bill_due_date = IF(provider_bill_id IS NOT NULL, due_date, NULL)` with
   `UNIQUE uq_bank_bill_payments_provider_bill (provider_bill_id, provider_bill_due_date)`.
   Keep `uq_bank_bill_payments_bill`.
6. Add VIRTUAL `recurring_description = IF(kind = 'recurring', description, NULL)` on
   `bank_provider_bills`, with `UNIQUE uq_bank_provider_bills_recurring_description
   (provider_account_id, recurring_description)`. Add the index
   `idx_bank_provider_bills_provider_kind_description (provider_account_id, kind, description)`.
   Keep `idx_bank_bills_provider_due` (renaming it is optional; if you rename it, `down` must
   handle both names).

## `down()` — tolerant of a partial `up`

Each step checks before acting, using `queryRunner.hasTable`, `hasColumn` and `getTable`
(indices / foreignKeys). Resolve the table name first: `bank_provider_bills` if it exists,
otherwise `bank_bills`. Order:

1. Drop the new unique keys and indexes, plus `recurring_description` and `provider_bill_due_date`.
2. Drop `derived_due_date` and recreate the original
   (`IF(bill_id IS NULL, due_date, NULL)` + `uq_bank_bill_payments_derived`).
3. Drop the `provider_bill_id` FK, its index and the column.
4. `DELETE FROM <bills> WHERE kind = 'recurring'`.
5. Drop the recurring columns and `kind`.
6. Rename `expected_amount` → `amount NOT NULL`, and restore `due_date NOT NULL`.
7. `RENAME TABLE bank_provider_bills TO bank_bills`.

## Unit spec

Add `backend/src/database/tests/bank-expand-provider-bills-migration.spec.ts`, following the
`bank-create-bills-migration.spec.ts` style:
- Extend `fake-query-runner.ts` with `hasTable`, `hasColumn` and `getTable` mocks. Feed the
  pre-flight results with `query.mockResolvedValueOnce`.
- Assert that the pre-flight queries run before any DDL, and that an offending result throws
  before any `ALTER` or `RENAME`, with a message of ids and dates only.
- Assert the statement order and the exported SQL: the VIRTUAL generated columns, the three keys
  and the backfill predicates (hidden bill, archived included).
- Assert the `down` order after a full `up`, and that `down` skips steps when
  `hasColumn` / `getTable` report them absent (partial state).

## Files to Change
- `backend/src/database/migrations/20261117120025-bank-expand-provider-bills.ts` — new migration.
- `backend/src/database/tests/fake-query-runner.ts` — add `hasTable`, `hasColumn` and `getTable`.
- `backend/src/database/tests/bank-expand-provider-bills-migration.spec.ts` — new unit spec.
