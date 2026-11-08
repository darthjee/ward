# Entity and migration
Create the `bank_investment_details` table, one-to-one with `bank_accounts`, mirroring
`bank_debt_details`.

- Entity `InvestmentDetails` (`@Entity('bank_investment_details')`):
  `@PrimaryColumn({ name: 'account_id', type: 'int' }) accountId`;
  `@OneToOne(() => Account, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'account_id' })`;
  `kind` `varchar(16)` nullable; `yieldRate` `decimal(7,4)` nullable typed `string | null`;
  `yieldPeriod` `varchar(16)` nullable; `maturityDate` `date` nullable typed `string | null`;
  `liquidityDays` `int` nullable; `@CreateDateColumn` / `@UpdateDateColumn`. No owner columns.
- Register the entity in `TypeOrmModule.forFeature([...])` in both `bank.module.ts` and
  `bank-routes.module.ts`.
- Migration `20261108120019-bank-create-investment-details.ts`, class
  `BankCreateInvestmentDetails20261108120019` (next counter after
  `20261108120018-bank-create-debt-details.ts`; use the current date if later, keeping the
  global counter). `createTable(..., true)` with the columns above plus `createdAtColumn()` /
  `updatedAtColumn()` from `migrations/helpers.ts`, FK `fk_bank_investment_details_account_id`
  → `bank_accounts.id` `ON DELETE CASCADE`. `down`: ``DROP TABLE IF EXISTS `bank_investment_details` ``.
- Unit spec copying `bank-create-debt-details-migration.spec.ts`.
- Integration: add the migration and entity to `test-data-source.ts` (`MIGRATIONS` in order,
  `ENTITIES`); add `'bank_investment_details'` to the expected tables in
  `migrations-round-trip.integration-spec.ts`; add a `describe('bank_investment_details')`
  block in `bank-schema.integration-spec.ts` (column types, PK duplicate, FK unknown account,
  cascade delete) and fix its `describe('down')`, which assumes debt details is the last
  migration (one more `undoLastMigration`).

## Files to Change
- `backend/src/bank/entities/investment-details.entity.ts` — new entity
- `backend/src/bank/bank.module.ts` — `forFeature` entry
- `backend/src/bank/bank-routes.module.ts` — `forFeature` entry
- `backend/src/database/migrations/20261108120019-bank-create-investment-details.ts` — new migration
- `backend/src/database/tests/bank-create-investment-details-migration.spec.ts` — new unit spec
- `backend/src/database/tests/integration/test-data-source.ts` — register migration + entity
- `backend/src/database/tests/integration/migrations-round-trip.integration-spec.ts` — expected tables
- `backend/src/database/tests/integration/bank-schema.integration-spec.ts` — new table block, `down` fix
