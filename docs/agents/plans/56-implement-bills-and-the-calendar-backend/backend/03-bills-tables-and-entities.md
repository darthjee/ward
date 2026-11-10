# Bills and bill-payments tables and entities

Create `bank_bills` and `bank_bill_payments` with their FKs, unique keys and indexes, and wire the entities everywhere the bank module and the test harnesses need them.

## Migration

Add `20261108120023-bank-create-bills.ts`. It may be split into `...023` for bills and `...024` for payments.

### `bank_bills`

**Columns** (built with `idColumn()`, `createdAtColumn()` and `updatedAtColumn()`):

- `id`;
- `provider_account_id NOT NULL`;
- `paying_account_id NULL`;
- `due_date DATE NOT NULL`;
- `amount BIGINT NOT NULL`;
- `description VARCHAR(255) NOT NULL`;
- `notes TEXT NULL`;
- `created_at` and `updated_at`.

**Foreign keys:**

- `provider_account_id` → `bank_accounts`, `ON DELETE CASCADE`;
- `paying_account_id` → `bank_accounts`, `ON DELETE SET NULL`.

**Index:** `idx_bank_bills_provider_due (provider_account_id, due_date)`.

### `bank_bill_payments`

**Columns:**

- `id`;
- `source_account_id NOT NULL`;
- `bill_id NULL`;
- `due_date DATE NOT NULL` (the nominal date);
- `status ENUM('paid','skipped')` or `VARCHAR`, following existing enum conventions;
- `paid_on DATE NULL`;
- `amount BIGINT NULL`;
- `paying_account_id NULL`;
- `payment_transaction_id NULL`, `withdrawal_transaction_id NULL`, `charge_transaction_id NULL`;
- `created_at` and `updated_at`.

**Foreign keys:**

- `source_account_id` → `bank_accounts`, `CASCADE`;
- `bill_id` → `bank_bills`, `CASCADE`;
- `paying_account_id` → `bank_accounts`, `SET NULL`;
- the three transaction ids → `bank_transactions`, `SET NULL`.

**Uniqueness:**

- `UNIQUE uq_bank_bill_payments_bill (bill_id)`. MySQL allows repeated NULLs, so derived rows never collide on it.
- For derived occurrences, a stored generated column `derived_due_date DATE AS (IF(bill_id IS NULL, due_date, NULL)) STORED` plus `UNIQUE uq_bank_bill_payments_derived (source_account_id, derived_due_date)`. This is how MySQL expresses "`(source_account_id, due_date)` where `bill_id` is null". If TypeORM's `Table` API cannot express the generated column cleanly, use `queryRunner.query` for that part.

**Index:** `idx_bank_bill_payments_source_due (source_account_id, due_date)`.

### `down`

Drop `bank_bill_payments` first, then `bank_bills` (`DROP TABLE IF EXISTS`).

## Entities

Add `bank/entities/bill.entity.ts` (`Bill`) and `bank/entities/bill-payment.entity.ts` (`BillPayment`):

- camelCase properties with snake_case `name`s;
- `bigintTransformer` on the amounts;
- `date` columns as strings;
- `derivedDueDate` as a read-only generated column, or simply not mapped.

## Wiring

Add `Bill` and `BillPayment` to:

- `forFeature` in **both** `bank-routes.module.ts` and `bank.module.ts`;
- `ENTITIES` and `MIGRATIONS` in `database/tests/integration/test-data-source.ts`;
- the e2e fake data source: `tests/support/build-bank-test-app.ts` (`repositoryFor`) and `tests/support/in-memory-bank-repos.ts`. The in-memory repos should enforce the two unique keys, so pay-twice → 409 is testable in e2e.

## Tests

- **Migration unit spec** with `fakeQueryRunner`.
- **`migrations-round-trip.integration-spec.ts`:** add `bank_bills` and `bank_bill_payments` to the exact `bank_` table list.
- **`bank-schema.integration-spec.ts`:** FKs with their delete rules, the unique keys (two derived payments for the same account and date → duplicate; two one-off payments for different bills on the same provider and date → fine) and the indexes.

## Files to Change

- `backend/src/database/migrations/20261108120023-bank-create-bills.ts` (and maybe `...024-bank-create-bill-payments.ts`) — the new tables
- `backend/src/database/tests/bank-create-bills-migration.spec.ts` — unit spec
- `backend/src/database/tests/integration/test-data-source.ts` — the migrations and entities
- `backend/src/database/tests/integration/migrations-round-trip.integration-spec.ts`, `bank-schema.integration-spec.ts` — the table list and schema checks
- `backend/src/bank/entities/bill.entity.ts`, `bill-payment.entity.ts` — new entities
- `backend/src/bank/bank-routes.module.ts`, `bank.module.ts` — `forFeature`
- `backend/src/bank/tests/support/build-bank-test-app.ts`, `in-memory-bank-repos.ts` — in-memory repos for the new entities
