import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table } from 'typeorm';
import { createdAtColumn, idColumn, updatedAtColumn } from './helpers.js';

const RECONCILIATIONS = 'bank_reconciliations';
const TRANSACTIONS = 'bank_transactions';

/**
 * The generated `open_key` and its unique index, added with raw SQL right after `createTable`
 * (same reasoning as `ACCOUNTS_CONSTRAINTS_SQL`: a generated column declared through `createTable`
 * would make TypeORM read its expression from a `typeorm_metadata` table this project never creates).
 * `open_key` is the account id while the statement is open and `NULL` once reconciled, so the unique
 * index allows at most one open statement per account (NULLs never collide). It holds an `INT`, so
 * it needs no collation.
 */
export const OPEN_KEY_SQL = `ALTER TABLE \`${RECONCILIATIONS}\`
  ADD COLUMN \`open_key\` INT AS (IF(\`reconciled_at\` IS NULL, \`account_id\`, NULL)) VIRTUAL,
  ADD UNIQUE INDEX \`idx_bank_reconciliations_open_key\` (\`open_key\`)`;

/** Adds the nullable link from a transaction to the statement it is ticked on. */
export const TRANSACTIONS_RECONCILIATION_SQL = `ALTER TABLE \`${TRANSACTIONS}\`
  ADD COLUMN \`reconciliation_id\` INT NULL,
  ADD INDEX \`idx_bank_transactions_reconciliation_id\` (\`reconciliation_id\`),
  ADD CONSTRAINT \`fk_bank_transactions_reconciliation_id\` FOREIGN KEY (\`reconciliation_id\`)
    REFERENCES \`${RECONCILIATIONS}\` (\`id\`) ON DELETE SET NULL`;

/**
 * Creates the Bank module's `bank_reconciliations` table (statement checkpoints, see
 * `docs/agents/modules/bank/reconciliation.md`, *Reconciliation entity* and *Migration*) and the nullable `bank_transactions.reconciliation_id`
 * link. `down` drops the link and then the table with raw SQL, because TypeORM's `dropTable` would try
 * to read the generated column's expression from `typeorm_metadata`; reconciliation data is lost on
 * rollback.
 */
export class BankCreateReconciliations20261123120027 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: RECONCILIATIONS,
        columns: [
          idColumn(),
          { name: 'account_id', type: 'int' },
          { name: 'statement_date', type: 'date' },
          { name: 'statement_balance', type: 'bigint' },
          { name: 'reconciled_at', type: 'datetime', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
        indices: [
          { name: 'idx_bank_reconciliations_account_id_statement_date', columnNames: ['account_id', 'statement_date'] },
        ],
        foreignKeys: [
          {
            name: 'fk_bank_reconciliations_account_id',
            columnNames: ['account_id'],
            referencedTableName: 'bank_accounts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(OPEN_KEY_SQL);
    await queryRunner.query(TRANSACTIONS_RECONCILIATION_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.#exists(queryRunner, 'TABLE_CONSTRAINTS', 'CONSTRAINT_NAME', 'fk_bank_transactions_reconciliation_id')) {
      await queryRunner.query(`ALTER TABLE \`${TRANSACTIONS}\` DROP FOREIGN KEY \`fk_bank_transactions_reconciliation_id\``);
    }
    if (await this.#exists(queryRunner, 'STATISTICS', 'INDEX_NAME', 'idx_bank_transactions_reconciliation_id')) {
      await queryRunner.query(`ALTER TABLE \`${TRANSACTIONS}\` DROP INDEX \`idx_bank_transactions_reconciliation_id\``);
    }
    if (await queryRunner.hasColumn(TRANSACTIONS, 'reconciliation_id')) {
      await queryRunner.query(`ALTER TABLE \`${TRANSACTIONS}\` DROP COLUMN \`reconciliation_id\``);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS \`${RECONCILIATIONS}\``);
  }

  async #exists(queryRunner: QueryRunner, view: string, column: string, name: string): Promise<boolean> {
    const rows = (await queryRunner.query(
      `SELECT 1 FROM information_schema.\`${view}\` WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND \`${column}\` = ? LIMIT 1`,
      [TRANSACTIONS, name],
    )) as unknown[] | undefined;
    return (rows ?? []).length > 0;
  }
}
