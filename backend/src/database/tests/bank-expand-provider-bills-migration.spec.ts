import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import {
  ADD_DERIVED_SQL,
  ADD_RECURRING_KEYS_SQL,
  BACKFILL_HIDDEN_SQL,
  BACKFILL_SCHEDULED_SQL,
  BankExpandProviderBills20261117120025,
  RESTORE_DERIVED_SQL,
} from '../migrations/20261117120025-bank-expand-provider-bills.js';

function sqls(runner: ReturnType<typeof fakeQueryRunner>): string[] {
  return runner.query.mock.calls.map(([sql]) => sql as string);
}

describe('BankExpandProviderBills20261117120025', () => {
  const migration = new BankExpandProviderBills20261117120025();

  describe('up', () => {
    it('runs the three pre-flight queries before any DDL', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const statements = sqls(runner);
      expect(statements.slice(0, 3).every((sql) => sql.startsWith('SELECT'))).toBe(true);
      expect(statements[3]).toBe('RENAME TABLE `bank_bills` TO `bank_provider_bills`');
      expect(statements[4]).toContain('CHANGE COLUMN `amount` `expected_amount`');
    });

    it('throws before any DDL on an offending pre-flight, listing only ids and dates', async () => {
      const runner = fakeQueryRunner();
      runner.query.mockResolvedValueOnce([{ account_id: 7, due_date: new Date('2026-03-05T00:00:00Z') }]);

      await expect(migration.up(asQueryRunner(runner))).rejects.toThrow('7:2026-03-05');

      expect(runner.query).toHaveBeenCalledTimes(1);
    });

    it('stops at an orphan-payment finding', async () => {
      const runner = fakeQueryRunner();
      runner.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ payment_id: 1, account_id: 2, due_date: '2026-01-01' }]);

      await expect(migration.up(asQueryRunner(runner))).rejects.toThrow('Orphan provider payments');

      expect(runner.query).toHaveBeenCalledTimes(3);
    });

    it('backfills scheduled (archived included) and hidden bills', () => {
      expect(BACKFILL_SCHEDULED_SQL).toContain('d.`due_day` IS NOT NULL');
      expect(BACKFILL_SCHEDULED_SQL).not.toContain('archived_at');
      expect(BACKFILL_HIDDEN_SQL).toContain('d.`due_day` IS NULL');
      expect(BACKFILL_HIDDEN_SQL).toContain("COALESCE(d.`charge_frequency`, 'monthly')");
      expect(BACKFILL_HIDDEN_SQL).toContain('FALSE');
    });

    it('declares the virtual generated columns and the three keys', () => {
      expect(ADD_DERIVED_SQL).toContain('IF(`bill_id` IS NULL AND `provider_bill_id` IS NULL, `due_date`, NULL)) VIRTUAL');
      expect(ADD_DERIVED_SQL).toContain('uq_bank_bill_payments_provider_bill` (`provider_bill_id`, `provider_bill_due_date`)');
      expect(ADD_RECURRING_KEYS_SQL).toContain('uq_bank_provider_bills_recurring_description` (`provider_account_id`, `recurring_description`)');
    });

    it('repoints payments after the bills exist', async () => {
      const runner = fakeQueryRunner();

      await migration.up(asQueryRunner(runner));

      const statements = sqls(runner);
      const backfill = statements.findIndex((sql) => sql === BACKFILL_HIDDEN_SQL);
      const repoint = statements.findIndex((sql) => sql.startsWith('UPDATE `bank_bill_payments`'));
      expect(repoint).toBeGreaterThan(backfill);
    });
  });

  describe('down', () => {
    it('reverts a full up in order', async () => {
      const runner = fakeQueryRunner();
      runner.query.mockImplementation(async (sql: string) => (sql.includes('information_schema') ? [{ 1: 1 }] : undefined));

      await migration.down(asQueryRunner(runner));

      const statements = sqls(runner);
      expect(statements[0]).toContain('DROP COLUMN `recurring_description`');
      expect(statements).toContain(RESTORE_DERIVED_SQL);
      expect(statements.some((sql) => sql.includes('DROP FOREIGN KEY'))).toBe(true);
      expect(statements.some((sql) => sql.includes("DELETE FROM `bank_provider_bills` WHERE `kind` = 'recurring'"))).toBe(true);
      expect(statements.at(-1)).toBe('RENAME TABLE `bank_provider_bills` TO `bank_bills`');
    });

    it('skips every step when the state is absent', async () => {
      const runner = fakeQueryRunner();
      runner.hasTable.mockResolvedValue(false);
      runner.hasColumn.mockResolvedValue(false);

      await migration.down(asQueryRunner(runner));

      expect(sqls(runner)).toEqual([RESTORE_DERIVED_SQL]);
    });
  });
});
