import type { Table } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import {
  BankCreateReconciliations20261123120027,
  OPEN_KEY_SQL,
  TRANSACTIONS_RECONCILIATION_SQL,
} from '../migrations/20261123120027-bank-create-reconciliations.js';

function sqls(runner: ReturnType<typeof fakeQueryRunner>): string[] {
  return runner.query.mock.calls.map((call) => call[0] as string);
}

describe('BankCreateReconciliations20261123120027', () => {
  const migration = new BankCreateReconciliations20261123120027();

  describe('up', () => {
    it('creates the table, then the generated open key, then the transactions link', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable', 'query', 'query']);
      expect(runner.createTable.mock.calls[0][1]).toBe(true);
      expect(sqls(runner)).toEqual([OPEN_KEY_SQL, TRANSACTIONS_RECONCILIATION_SQL]);
    });

    it('declares the columns, the index and the account FK', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const table = runner.createTable.mock.calls[0][0] as Table;
      expect(table.name).toBe('bank_reconciliations');
      expect(table.columns.map((c) => [c.name, c.type, c.isNullable])).toEqual([
        ['id', 'int', false],
        ['account_id', 'int', false],
        ['statement_date', 'date', false],
        ['statement_balance', 'bigint', false],
        ['reconciled_at', 'datetime', true],
        ['created_at', 'datetime', false],
        ['updated_at', 'datetime', false],
      ]);
      expect(table.indices.map((i) => [i.name, i.columnNames, i.isUnique])).toEqual([
        ['idx_bank_reconciliations_account_id_statement_date', ['account_id', 'statement_date'], false],
      ]);
      expect(table.foreignKeys.map((fk) => [fk.name, fk.columnNames, fk.referencedTableName, fk.onDelete])).toEqual([
        ['fk_bank_reconciliations_account_id', ['account_id'], 'bank_accounts', 'CASCADE'],
      ]);
    });

    it('generates open_key from the open state with a unique index', () => {
      expect(OPEN_KEY_SQL).toContain('`open_key` INT AS (IF(`reconciled_at` IS NULL, `account_id`, NULL)) VIRTUAL');
      expect(OPEN_KEY_SQL).toContain('ADD UNIQUE INDEX `idx_bank_reconciliations_open_key` (`open_key`)');
      expect(OPEN_KEY_SQL).not.toContain('COLLATE');
    });

    it('adds the nullable reconciliation_id with its index and ON DELETE SET NULL FK', () => {
      expect(TRANSACTIONS_RECONCILIATION_SQL).toContain('ALTER TABLE `bank_transactions`');
      expect(TRANSACTIONS_RECONCILIATION_SQL).toContain('ADD COLUMN `reconciliation_id` INT NULL');
      expect(TRANSACTIONS_RECONCILIATION_SQL).toContain('ADD INDEX `idx_bank_transactions_reconciliation_id` (`reconciliation_id`)');
      expect(TRANSACTIONS_RECONCILIATION_SQL).toContain('FOREIGN KEY (`reconciliation_id`)');
      expect(TRANSACTIONS_RECONCILIATION_SQL).toContain('REFERENCES `bank_reconciliations` (`id`) ON DELETE SET NULL');
    });
  });

  describe('down', () => {
    it('drops the FK, the index, the column and then the table', async () => {
      const runner = fakeQueryRunner();
      runner.query.mockImplementation(async (sql: string) => (sql.includes('information_schema') ? [{ 1: 1 }] : undefined));

      await migration.down(asQueryRunner(runner));

      const statements = sqls(runner).filter((sql) => !sql.includes('information_schema'));
      expect(statements).toEqual([
        'ALTER TABLE `bank_transactions` DROP FOREIGN KEY `fk_bank_transactions_reconciliation_id`',
        'ALTER TABLE `bank_transactions` DROP INDEX `idx_bank_transactions_reconciliation_id`',
        'ALTER TABLE `bank_transactions` DROP COLUMN `reconciliation_id`',
        'DROP TABLE IF EXISTS `bank_reconciliations`',
      ]);
    });

    it('skips the guarded drops when nothing exists', async () => {
      const runner = fakeQueryRunner();
      runner.query.mockImplementation(async () => []);
      runner.hasColumn.mockResolvedValue(false);

      await migration.down(asQueryRunner(runner));

      const statements = sqls(runner).filter((sql) => !sql.includes('information_schema'));
      expect(statements).toEqual(['DROP TABLE IF EXISTS `bank_reconciliations`']);
    });
  });
});
