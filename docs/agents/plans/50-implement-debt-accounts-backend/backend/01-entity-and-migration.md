# Add the `DebtDetails` entity and migration

Create the 1:1 `bank_debt_details` table and its TypeORM entity, and register both everywhere
entities and migrations are listed.

- Entity `DebtDetails` (`backend/src/bank/entities/debt-details.entity.ts`), table
  `bank_debt_details`:
  - `accountId` → `account_id`: primary key **and** real FK to `bank_accounts.id`
    (`ON DELETE CASCADE`), same column type as `bank_accounts.id`. `@OneToOne(() => Account)`
    + `@JoinColumn({ name: 'account_id' })` (no inverse side needed on `Account`).
  - `interestRate` `DECIMAL(7,4) NULL` (string in TS).
  - `interestPeriod` `VARCHAR(16) NULL` (`'monthly' | 'yearly'`).
  - `instalmentAmount` `BIGINT NULL` with `bigintTransformer`.
  - `dueDay` `TINYINT NULL`, `dueMonth` `TINYINT NULL`, `instalmentCount` `INT NULL`.
  - `instalmentFrequency` `VARCHAR(16) NOT NULL DEFAULT 'monthly'`.
  - `created_at` / `updated_at` via the shared helpers, for consistency with other bank tables.
  - No owner columns — the owner comes from the account.
- Migration `backend/src/database/migrations/<YYYYMMDD>120018-bank-create-debt-details.ts`
  (class `BankCreateDebtDetails<timestamp>`), following `20261108120017-bank-create-transactions.ts`:
  `up` creates the table + FK with `onDelete: 'CASCADE'`; `down` drops it.
- Register the entity in `TypeOrmModule.forFeature([...])` of both
  `bank/bank-routes.module.ts` (resident) and `bank/bank.module.ts` (lazy), and in `ENTITIES`
  of `database/tests/integration/test-data-source.ts`; add the migration to `MIGRATIONS` there.

## Files to Change
- `backend/src/bank/entities/debt-details.entity.ts` — new entity.
- `backend/src/database/migrations/<ts>-bank-create-debt-details.ts` — new migration.
- `backend/src/bank/bank-routes.module.ts` — add entity to `forFeature`.
- `backend/src/bank/bank.module.ts` — add entity to `forFeature`.
- `backend/src/database/tests/integration/test-data-source.ts` — add entity and migration.
- `backend/src/database/tests/bank-create-debt-details-migration.spec.ts` — new migration unit spec (fake query runner).
- `backend/src/database/tests/integration/bank-schema.integration-spec.ts` — assert the table, PK/FK and `ON DELETE CASCADE` (deleting an account removes its row).
