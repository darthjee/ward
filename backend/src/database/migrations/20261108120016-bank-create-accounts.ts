import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table } from 'typeorm';
import { createdAtColumn, idColumn, updatedAtColumn } from './helpers.js';

const ACCOUNTS = 'bank_accounts';

/**
 * The generated name key, its two per-owner unique indexes and the
 * exactly-one-owner check, added with raw SQL right after `createTable`:
 * - TypeORM's MySQL driver does not support check constraints at all
 *   (`createCheckConstraint` throws, and `createTable` silently drops
 *   `checks`);
 * - a generated column declared through `createTable` would make TypeORM
 *   write (and later read) its expression in a `typeorm_metadata` table this
 *   project never creates.
 *
 * `active_name_key` uses `utf8mb4_0900_as_cs` so that `LOWER()` alone gives
 * the case-insensitivity: under the default `utf8mb4_0900_ai_ci` the key
 * would also be accent-insensitive and "Itaú" would clash with "Itau". The
 * two unique indexes double as the owner lookup indexes.
 */
export const ACCOUNTS_CONSTRAINTS_SQL = `ALTER TABLE \`${ACCOUNTS}\`
  ADD COLUMN \`active_name_key\` VARCHAR(255) COLLATE utf8mb4_0900_as_cs
    AS (IF(\`archived_at\` IS NULL, LOWER(\`name\`), NULL)) VIRTUAL,
  ADD UNIQUE INDEX \`idx_bank_accounts_user_id_active_name_key\` (\`user_id\`, \`active_name_key\`),
  ADD UNIQUE INDEX \`idx_bank_accounts_organization_id_active_name_key\` (\`organization_id\`, \`active_name_key\`),
  ADD CONSTRAINT \`bank_accounts_exactly_one_owner\` CHECK ((\`user_id\` IS NULL) <> (\`organization_id\` IS NULL))`;

/**
 * Creates the Bank module's `bank_accounts` table (see
 * `docs/agents/modules/bank/accounts.md`, *Regular accounts*). `user_id` and
 * `organization_id` are **logical** references to `auth` (no FK); exactly one
 * of them is set (DB check). Amounts (`opening_balance`) are integer minor
 * units. `down` drops the table with raw SQL, because TypeORM's `dropTable`
 * would try to read the generated column's expression from `typeorm_metadata`.
 */
export class BankCreateAccounts20261108120016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: ACCOUNTS,
        columns: [
          idColumn(),
          { name: 'user_id', type: 'int', isNullable: true },
          { name: 'organization_id', type: 'int', isNullable: true },
          { name: 'type', type: 'varchar', length: '32' },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'bank_name', type: 'varchar', length: '64', isNullable: true },
          { name: 'branch', type: 'varchar', length: '64', isNullable: true },
          { name: 'account_number', type: 'varchar', length: '64', isNullable: true },
          { name: 'currency', type: 'char', length: '3' },
          { name: 'opening_date', type: 'date' },
          { name: 'opening_balance', type: 'bigint', default: 0 },
          { name: 'archived_at', type: 'datetime', isNullable: true },
          { name: 'notes', type: 'text', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
      }),
      true,
    );

    await queryRunner.query(ACCOUNTS_CONSTRAINTS_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`${ACCOUNTS}\``);
  }
}
