import type { Table } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import {
  ACCOUNTS_CONSTRAINTS_SQL,
  BankCreateAccounts20261108120016,
} from '../migrations/20261108120016-bank-create-accounts.js';

function createdTable(runner: ReturnType<typeof fakeQueryRunner>): Table {
  return runner.createTable.mock.calls[0][0] as Table;
}

describe('BankCreateAccounts20261108120016', () => {
  const migration = new BankCreateAccounts20261108120016();

  describe('up', () => {
    it('creates bank_accounts if missing, then adds the generated key, indexes and check', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable', 'query']);
      expect(createdTable(runner).name).toBe('bank_accounts');
      expect(runner.createTable.mock.calls[0][1]).toBe(true);
      expect(runner.query).toHaveBeenCalledWith(ACCOUNTS_CONSTRAINTS_SQL);
    });

    it('declares the columns, with nullable logical owner references', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(createdTable(runner).columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['id', 'int', '', false],
        ['user_id', 'int', '', true],
        ['organization_id', 'int', '', true],
        ['type', 'varchar', '32', false],
        ['name', 'varchar', '255', false],
        ['bank_name', 'varchar', '64', true],
        ['branch', 'varchar', '64', true],
        ['account_number', 'varchar', '64', true],
        ['currency', 'char', '3', false],
        ['opening_date', 'date', '', false],
        ['opening_balance', 'bigint', '', false],
        ['archived_at', 'datetime', '', true],
        ['notes', 'text', '', true],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
      expect(createdTable(runner).foreignKeys).toEqual([]);
    });

    it('defaults opening_balance to 0', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(createdTable(runner).columns.find((c) => c.name === 'opening_balance')?.default).toBe(0);
    });

    it('builds the accent-sensitive generated key, the two unique indexes and the owner check', () => {
      expect(ACCOUNTS_CONSTRAINTS_SQL).toContain(
        'COLLATE utf8mb4_0900_as_cs\n    AS (IF(`archived_at` IS NULL, LOWER(`name`), NULL)) VIRTUAL',
      );
      expect(ACCOUNTS_CONSTRAINTS_SQL).toContain('UNIQUE INDEX `idx_bank_accounts_user_id_active_name_key` (`user_id`, `active_name_key`)');
      expect(ACCOUNTS_CONSTRAINTS_SQL).toContain(
        'UNIQUE INDEX `idx_bank_accounts_organization_id_active_name_key` (`organization_id`, `active_name_key`)',
      );
      expect(ACCOUNTS_CONSTRAINTS_SQL).toContain(
        'CONSTRAINT `bank_accounts_exactly_one_owner` CHECK ((`user_id` IS NULL) <> (`organization_id` IS NULL))',
      );
    });
  });

  describe('down', () => {
    it('drops the table with raw SQL', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.calls).toEqual(['query']);
      expect(runner.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS `bank_accounts`');
    });
  });
});
