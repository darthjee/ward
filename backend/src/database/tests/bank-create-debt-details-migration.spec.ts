import type { Table } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { BankCreateDebtDetails20261108120018 } from '../migrations/20261108120018-bank-create-debt-details.js';

function createdTable(runner: ReturnType<typeof fakeQueryRunner>): Table {
  return runner.createTable.mock.calls[0][0] as Table;
}

describe('BankCreateDebtDetails20261108120018', () => {
  const migration = new BankCreateDebtDetails20261108120018();

  describe('up', () => {
    it('creates bank_debt_details if missing', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable']);
      expect(createdTable(runner).name).toBe('bank_debt_details');
      expect(runner.createTable.mock.calls[0][1]).toBe(true);
    });

    it('declares the columns, without any owner column', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(createdTable(runner).columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['account_id', 'int', '', false],
        ['interest_rate', 'decimal', '', true],
        ['interest_period', 'varchar', '16', true],
        ['instalment_amount', 'bigint', '', true],
        ['instalment_frequency', 'varchar', '16', false],
        ['due_day', 'tinyint', '', true],
        ['due_month', 'tinyint', '', true],
        ['instalment_count', 'int', '', true],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
    });

    it('uses account_id as the (non-generated) primary key', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const accountId = createdTable(runner).columns.find((c) => c.name === 'account_id');
      expect(accountId?.isPrimary).toBe(true);
      expect(accountId?.isGenerated).toBe(false);
    });

    it('declares interest_rate as DECIMAL(7,4) and defaults the frequency to monthly', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const columns = createdTable(runner).columns;
      const rate = columns.find((c) => c.name === 'interest_rate');
      expect([rate?.precision, rate?.scale]).toEqual([7, 4]);
      expect(columns.find((c) => c.name === 'instalment_frequency')?.default).toBe("'monthly'");
    });

    it('adds a real ON DELETE CASCADE FK to bank_accounts', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(
        createdTable(runner).foreignKeys.map((fk) => [fk.columnNames, fk.referencedTableName, fk.referencedColumnNames, fk.onDelete]),
      ).toEqual([[['account_id'], 'bank_accounts', ['id'], 'CASCADE']]);
    });
  });

  describe('down', () => {
    it('drops the table with raw SQL', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS `bank_debt_details`');
    });
  });
});
