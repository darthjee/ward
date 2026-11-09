# Entity and migration

Create the `ProviderExpenseDetails` entity and the migration for `bank_provider_expense_details`,
copying the shape of `DebtDetails` / `BankCreateInvestmentDetails20261108120019`.

Columns:

| Column | Type | Null | Default |
|---|---|---|---|
| `account_id` | int, PK (not generated), FK → `bank_accounts.id` `ON DELETE CASCADE` (`fk_bank_provider_expense_details_account_id`) | no | — |
| `for_accountant` | boolean (tinyint) | no | `true` |
| `provider_tax_id` | varchar(32) | yes | — |
| `expected_amount` | bigint (minor units, `bigintTransformer`) | yes | — |
| `due_day` | tinyint | yes | — |
| `charge_frequency` | varchar(16) | no | `'monthly'` |
| `due_month` | tinyint | yes | — |
| `created_at` / `updated_at` | via `createdAtColumn()` / `updatedAtColumn()` | | |

No owner columns. Migration `up` uses `createTable(new Table({...}), true)`; `down` runs
`DROP TABLE IF EXISTS \`bank_provider_expense_details\``.

Register the entity in `bank.module.ts` (`TypeOrmModule.forFeature`) and
`bank-routes.module.ts` (resident `forFeature` list), and in the MySQL integration data source.
Cover with a migration unit spec (as the investment one: `createTable` only, `ifNotExists`,
column tuples, PK not generated, defaults of `for_accountant` / `charge_frequency`, FK tuple,
`down`) and extend the MySQL integration specs (column types / nullability, PK duplicate,
unknown-account FK failure, cascade delete, round-trip table list, one extra "down" step).

## Files to Change

- `backend/src/bank/entities/provider-expense-details.entity.ts` — new entity.
- `backend/src/database/migrations/20261108120020-bank-create-provider-expense-details.ts` — new
  migration, class `BankCreateProviderExpenseDetails20261108120020`.
- `backend/src/database/tests/bank-create-provider-expense-details-migration.spec.ts` — new
  migration unit spec.
- `backend/src/bank/bank.module.ts` — entity in `forFeature`.
- `backend/src/bank/bank-routes.module.ts` — entity in the resident `forFeature` list.
- `backend/src/database/tests/integration/test-data-source.ts` — add migration to `MIGRATIONS`,
  entity to `ENTITIES`.
- `backend/src/database/tests/integration/migrations-round-trip.integration-spec.ts` — add the
  table to the `bank_` list (alphabetical).
- `backend/src/database/tests/integration/bank-schema.integration-spec.ts` — provider-expense
  details describe and the extra `undoLastMigration` step.
