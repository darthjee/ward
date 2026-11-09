import type { Table } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { BankCreateProviderExpenseDetails20261108120020 } from '../migrations/20261108120020-bank-create-provider-expense-details.js';

function createdTable(runner: ReturnType<typeof fakeQueryRunner>): Table {
  return runner.createTable.mock.calls[0][0] as Table;
}

describe('BankCreateProviderExpenseDetails20261108120020', () => {
  const migration = new BankCreateProviderExpenseDetails20261108120020();

  describe('up', () => {
    it('creates bank_provider_expense_details if missing', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable']);
      expect(createdTable(runner).name).toBe('bank_provider_expense_details');
      expect(runner.createTable.mock.calls[0][1]).toBe(true);
    });

    it('declares the columns, without any owner column', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(createdTable(runner).columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['account_id', 'int', '', false],
        ['for_accountant', 'boolean', '', false],
        ['provider_tax_id', 'varchar', '32', true],
        ['expected_amount', 'bigint', '', true],
        ['due_day', 'tinyint', '', true],
        ['charge_frequency', 'varchar', '16', false],
        ['due_month', 'tinyint', '', true],
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

    it('defaults for_accountant to true and the charge frequency to monthly', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const columns = createdTable(runner).columns;
      expect(columns.find((c) => c.name === 'for_accountant')?.default).toBe(true);
      expect(columns.find((c) => c.name === 'charge_frequency')?.default).toBe("'monthly'");
    });

    it('adds a real ON DELETE CASCADE FK to bank_accounts', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(
        createdTable(runner).foreignKeys.map((fk) => [fk.name, fk.columnNames, fk.referencedTableName, fk.referencedColumnNames, fk.onDelete]),
      ).toEqual([['fk_bank_provider_expense_details_account_id', ['account_id'], 'bank_accounts', ['id'], 'CASCADE']]);
    });
  });

  describe('down', () => {
    it('drops the table with raw SQL', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS `bank_provider_expense_details`');
    });
  });
});
