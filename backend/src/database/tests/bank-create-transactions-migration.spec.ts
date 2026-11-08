import type { Table } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { BankCreateTransactions20261108120017 } from '../migrations/20261108120017-bank-create-transactions.js';

function createdTable(runner: ReturnType<typeof fakeQueryRunner>): Table {
  return runner.createTable.mock.calls[0][0] as Table;
}

describe('BankCreateTransactions20261108120017', () => {
  const migration = new BankCreateTransactions20261108120017();

  describe('up', () => {
    it('creates bank_transactions if missing', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable']);
      expect(createdTable(runner).name).toBe('bank_transactions');
      expect(runner.createTable.mock.calls[0][1]).toBe(true);
    });

    it('declares the columns, without any owner or sent_to_accountant_at column', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(createdTable(runner).columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['id', 'int', '', false],
        ['account_id', 'int', '', false],
        ['date', 'date', '', false],
        ['amount', 'bigint', '', false],
        ['description', 'varchar', '255', false],
        ['notes', 'text', '', true],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
    });

    it('adds the (account_id, date, id) index', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(createdTable(runner).indices.map((i) => [i.name, i.columnNames, i.isUnique])).toEqual([
        ['idx_bank_transactions_account_id_date_id', ['account_id', 'date', 'id'], false],
      ]);
    });

    it('adds a real ON DELETE RESTRICT FK to bank_accounts', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(
        createdTable(runner).foreignKeys.map((fk) => [fk.columnNames, fk.referencedTableName, fk.referencedColumnNames, fk.onDelete]),
      ).toEqual([[['account_id'], 'bank_accounts', ['id'], 'RESTRICT']]);
    });
  });

  describe('down', () => {
    it('drops the table with raw SQL', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS `bank_transactions`');
    });
  });
});
