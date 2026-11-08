import type { Table } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { BankCreateInvestmentDetails20261108120019 } from '../migrations/20261108120019-bank-create-investment-details.js';

function createdTable(runner: ReturnType<typeof fakeQueryRunner>): Table {
  return runner.createTable.mock.calls[0][0] as Table;
}

describe('BankCreateInvestmentDetails20261108120019', () => {
  const migration = new BankCreateInvestmentDetails20261108120019();

  describe('up', () => {
    it('creates bank_investment_details if missing', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable']);
      expect(createdTable(runner).name).toBe('bank_investment_details');
      expect(runner.createTable.mock.calls[0][1]).toBe(true);
    });

    it('declares the columns, without any owner column', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(createdTable(runner).columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['account_id', 'int', '', false],
        ['kind', 'varchar', '16', true],
        ['yield_rate', 'decimal', '', true],
        ['yield_period', 'varchar', '16', true],
        ['maturity_date', 'date', '', true],
        ['liquidity_days', 'int', '', true],
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

    it('declares yield_rate as DECIMAL(7,4)', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const rate = createdTable(runner).columns.find((c) => c.name === 'yield_rate');
      expect([rate?.precision, rate?.scale]).toEqual([7, 4]);
    });

    it('adds a real ON DELETE CASCADE FK to bank_accounts', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(
        createdTable(runner).foreignKeys.map((fk) => [fk.name, fk.columnNames, fk.referencedTableName, fk.referencedColumnNames, fk.onDelete]),
      ).toEqual([['fk_bank_investment_details_account_id', ['account_id'], 'bank_accounts', ['id'], 'CASCADE']]);
    });
  });

  describe('down', () => {
    it('drops the table with raw SQL', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS `bank_investment_details`');
    });
  });
});
