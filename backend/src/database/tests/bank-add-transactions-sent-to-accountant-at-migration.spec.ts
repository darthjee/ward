import type { TableColumn } from 'typeorm';
import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import { BankAddTransactionsSentToAccountantAt20261108120021 } from '../migrations/20261108120021-bank-add-transactions-sent-to-accountant-at.js';

describe('BankAddTransactionsSentToAccountantAt20261108120021', () => {
  const migration = new BankAddTransactionsSentToAccountantAt20261108120021();

  describe('up', () => {
    it('only adds the column (no backfill)', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      expect(runner.calls).toEqual(['addColumn']);
    });

    it('adds sent_to_accountant_at as a nullable datetime with no default', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const [table, column] = runner.addColumn.mock.calls[0] as [string, TableColumn];
      expect(table).toBe('bank_transactions');
      expect([column.name, column.type, column.isNullable, column.default]).toEqual([
        'sent_to_accountant_at',
        'datetime',
        true,
        undefined,
      ]);
    });
  });

  describe('down', () => {
    it('drops the column', async () => {
      const runner = fakeQueryRunner();

      await migration.down(asQueryRunner(runner));

      expect(runner.calls).toEqual(['dropColumn']);
      expect(runner.dropColumn).toHaveBeenCalledWith('bank_transactions', 'sent_to_accountant_at');
    });
  });
});
