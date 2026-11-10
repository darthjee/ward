import type { Table } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { BankCreateBills20261108120023, BILL_PAYMENTS_DERIVED_KEY_SQL } from '../migrations/20261108120023-bank-create-bills.js';

function createdTable(runner: ReturnType<typeof fakeQueryRunner>, index: number): Table {
  return runner.createTable.mock.calls[index][0] as Table;
}

describe('BankCreateBills20261108120023', () => {
  const migration = new BankCreateBills20261108120023();

  describe('up', () => {
    it('creates bank_bills, then bank_bill_payments, then the derived key', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['createTable', 'createTable', 'query']);
      expect([createdTable(runner, 0).name, createdTable(runner, 1).name]).toEqual(['bank_bills', 'bank_bill_payments']);
      expect(runner.createTable.mock.calls.map((call) => call[1])).toEqual([true, true]);
      expect(runner.query).toHaveBeenCalledWith(BILL_PAYMENTS_DERIVED_KEY_SQL);
    });

    it('declares the bank_bills columns, without any owner column', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(createdTable(runner, 0).columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['id', 'int', '', false],
        ['provider_account_id', 'int', '', false],
        ['paying_account_id', 'int', '', true],
        ['due_date', 'date', '', false],
        ['amount', 'bigint', '', false],
        ['description', 'varchar', '255', false],
        ['notes', 'text', '', true],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
    });

    it('declares the bank_bills index and FKs', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const table = createdTable(runner, 0);
      expect(table.indices.map((i) => [i.name, i.columnNames, i.isUnique])).toEqual([
        ['idx_bank_bills_provider_due', ['provider_account_id', 'due_date'], false],
      ]);
      expect(table.foreignKeys.map((fk) => [fk.name, fk.columnNames, fk.referencedTableName, fk.onDelete])).toEqual([
        ['fk_bank_bills_provider_account_id', ['provider_account_id'], 'bank_accounts', 'CASCADE'],
        ['fk_bank_bills_paying_account_id', ['paying_account_id'], 'bank_accounts', 'SET NULL'],
      ]);
    });

    it('declares the bank_bill_payments columns, without any owner column', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(createdTable(runner, 1).columns.map((c) => [c.name, c.type, c.length, c.isNullable])).toEqual([
        ['id', 'int', '', false],
        ['source_account_id', 'int', '', false],
        ['bill_id', 'int', '', true],
        ['due_date', 'date', '', false],
        ['status', 'varchar', '16', false],
        ['paid_on', 'date', '', true],
        ['amount', 'bigint', '', true],
        ['paying_account_id', 'int', '', true],
        ['payment_transaction_id', 'int', '', true],
        ['withdrawal_transaction_id', 'int', '', true],
        ['charge_transaction_id', 'int', '', true],
        ['created_at', 'datetime', '', false],
        ['updated_at', 'datetime', '', false],
      ]);
    });

    it('declares the bank_bill_payments keys and FKs', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const table = createdTable(runner, 1);
      expect(table.indices.map((i) => [i.name, i.columnNames, i.isUnique])).toEqual([
        ['uq_bank_bill_payments_bill', ['bill_id'], true],
        ['idx_bank_bill_payments_source_due', ['source_account_id', 'due_date'], false],
      ]);
      expect(table.foreignKeys.map((fk) => [fk.columnNames[0], fk.referencedTableName, fk.onDelete])).toEqual([
        ['source_account_id', 'bank_accounts', 'CASCADE'],
        ['bill_id', 'bank_bills', 'CASCADE'],
        ['paying_account_id', 'bank_accounts', 'SET NULL'],
        ['payment_transaction_id', 'bank_transactions', 'SET NULL'],
        ['withdrawal_transaction_id', 'bank_transactions', 'SET NULL'],
        ['charge_transaction_id', 'bank_transactions', 'SET NULL'],
      ]);
    });

    it('builds the derived key from a virtual generated column', () => {
      expect(BILL_PAYMENTS_DERIVED_KEY_SQL).toContain('AS (IF(`bill_id` IS NULL, `due_date`, NULL)) VIRTUAL');
      expect(BILL_PAYMENTS_DERIVED_KEY_SQL).toContain(
        'ADD UNIQUE INDEX `uq_bank_bill_payments_derived` (`source_account_id`, `derived_due_date`)',
      );
    });
  });

  describe('down', () => {
    it('drops bank_bill_payments, then bank_bills', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.query.mock.calls.map(([sql]) => sql)).toEqual([
        'DROP TABLE IF EXISTS `bank_bill_payments`',
        'DROP TABLE IF EXISTS `bank_bills`',
      ]);
    });
  });
});
