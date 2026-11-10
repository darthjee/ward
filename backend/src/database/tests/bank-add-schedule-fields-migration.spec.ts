import type { TableColumn, TableForeignKey } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { BankAddScheduleFields20261108120022 } from '../migrations/20261108120022-bank-add-schedule-fields.js';

const TABLES = ['bank_debt_details', 'bank_provider_expense_details'];

describe('BankAddScheduleFields20261108120022', () => {
  const migration = new BankAddScheduleFields20261108120022();

  describe('up', () => {
    it('adds the columns, the FK and the backfill, table by table', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['addColumns', 'createForeignKey', 'query', 'addColumns', 'createForeignKey', 'query']);
    });

    it.each(TABLES)('adds bills_from, show_in_calendar and paying_account_id to %s', async (table) => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const call = runner.addColumns.mock.calls.find(([name]) => name === table) as [string, TableColumn[]];
      expect(call[1].map((column) => [column.name, column.type, column.isNullable, column.default])).toEqual([
        ['bills_from', 'date', true, undefined],
        ['show_in_calendar', 'boolean', false, true],
        ['paying_account_id', 'int', true, undefined],
      ]);
    });

    it.each(TABLES)('adds the paying-account FK (ON DELETE SET NULL) to %s', async (table) => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const call = runner.createForeignKey.mock.calls.find(([name]) => name === table) as [string, TableForeignKey];
      expect(call[1]).toMatchObject({
        name: `fk_${table}_paying_account`,
        columnNames: ['paying_account_id'],
        referencedTableName: 'bank_accounts',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      });
    });

    it('backfills bills_from with the UTC date where due_day is set', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.query.mock.calls.map(([sql]) => sql)).toEqual(
        TABLES.map((table) => `UPDATE \`${table}\` SET bills_from = UTC_DATE() WHERE due_day IS NOT NULL`),
      );
    });
  });

  describe('down', () => {
    it('drops the FK, then the three columns, table by table', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.calls).toEqual([
        'dropForeignKey', 'dropColumn', 'dropColumn', 'dropColumn',
        'dropForeignKey', 'dropColumn', 'dropColumn', 'dropColumn',
      ]);
      for (const table of TABLES) {
        expect(runner.dropForeignKey).toHaveBeenCalledWith(table, `fk_${table}_paying_account`);
        expect(runner.dropColumn).toHaveBeenCalledWith(table, 'paying_account_id');
        expect(runner.dropColumn).toHaveBeenCalledWith(table, 'show_in_calendar');
        expect(runner.dropColumn).toHaveBeenCalledWith(table, 'bills_from');
      }
    });
  });
});
