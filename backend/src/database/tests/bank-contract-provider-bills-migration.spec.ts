import { asQueryRunner, fakeQueryRunner } from './fake-query-runner.js';
import {
  ADD_FK_CLAUSE,
  BACKFILL_SQL,
  BankContractProviderBills20261120120026,
  DROP_SCHEDULE_SQL,
  SCHEDULE_COLUMNS,
} from '../migrations/20261120120026-bank-contract-provider-bills.js';

function sqls(runner: ReturnType<typeof fakeQueryRunner>): string[] {
  return runner.query.mock.calls.map(([sql]) => sql as string);
}

function ddl(runner: ReturnType<typeof fakeQueryRunner>): string[] {
  return sqls(runner).filter((sql) => !sql.includes('information_schema'));
}

/** Answers the `information_schema` existence checks: `present` names exist, others don't. */
function withExisting(runner: ReturnType<typeof fakeQueryRunner>, present: string[]): void {
  runner.query.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (!sql.includes('information_schema')) return undefined;
    return present.includes(String(params?.[1])) ? [{ 1: 1 }] : [];
  });
}

const COLUMN_NAMES = SCHEDULE_COLUMNS.map(([name]) => name);
const FK = 'fk_bank_provider_expense_details_paying_account';

describe('BankContractProviderBills20261120120026', () => {
  const migration = new BankContractProviderBills20261120120026();

  describe('up', () => {
    it('drops the FK and the seven columns in a single ALTER', async () => {
      const runner = fakeQueryRunner();
      withExisting(runner, [...COLUMN_NAMES, FK]);

      await migration.up(asQueryRunner(runner));

      expect(ddl(runner)).toEqual([DROP_SCHEDULE_SQL]);
      expect(DROP_SCHEDULE_SQL).toContain(`DROP FOREIGN KEY \`${FK}\``);
      for (const name of COLUMN_NAMES) {
        expect(DROP_SCHEDULE_SQL).toContain(`DROP COLUMN \`${name}\``);
      }
      expect(DROP_SCHEDULE_SQL).not.toContain('for_accountant');
      expect(DROP_SCHEDULE_SQL).not.toContain('provider_tax_id');
    });

    it('is skipped when the columns are already gone', async () => {
      const runner = fakeQueryRunner();
      withExisting(runner, []);

      await migration.up(asQueryRunner(runner));

      expect(ddl(runner)).toEqual([]);
    });
  });

  describe('down', () => {
    it('re-adds the columns and FK in one ALTER, then backfills', async () => {
      const runner = fakeQueryRunner();
      withExisting(runner, []);

      await migration.down(asQueryRunner(runner));

      const statements = ddl(runner);
      expect(statements).toHaveLength(2);
      expect(statements[0]).toMatch(/^ALTER TABLE `bank_provider_expense_details`/);
      for (const [name, definition] of SCHEDULE_COLUMNS) {
        expect(statements[0]).toContain(`ADD COLUMN \`${name}\` ${definition}`);
      }
      expect(statements[0]).toContain(ADD_FK_CLAUSE);
      expect(statements[0]).toContain('ON DELETE SET NULL');
      expect(statements[1]).toBe(BACKFILL_SQL);
    });

    it('skips the columns and the FK that already exist (re-run after a partial failure)', async () => {
      const runner = fakeQueryRunner();
      withExisting(runner, ['expected_amount', 'charge_frequency', FK]);

      await migration.down(asQueryRunner(runner));

      const [alter] = ddl(runner);
      expect(alter).not.toContain('`expected_amount`');
      expect(alter).not.toContain('`charge_frequency`');
      expect(alter).not.toContain('ADD CONSTRAINT');
      expect(alter).toContain('ADD COLUMN `due_day` TINYINT NULL');
    });

    it('only backfills when everything already exists', async () => {
      const runner = fakeQueryRunner();
      withExisting(runner, [...COLUMN_NAMES, FK]);

      await migration.down(asQueryRunner(runner));

      expect(ddl(runner)).toEqual([BACKFILL_SQL]);
    });

    it('backfills from the single recurring bill only, with COALESCE defaults', () => {
      expect(BACKFILL_SQL).toContain("`kind` = 'recurring'");
      expect(BACKFILL_SQL).toContain('HAVING COUNT(*) = 1');
      expect(BACKFILL_SQL).toContain("COALESCE(b.`charge_frequency`, 'monthly')");
      expect(BACKFILL_SQL).toContain('COALESCE(b.`show_in_calendar`, 1)');
    });
  });
});
