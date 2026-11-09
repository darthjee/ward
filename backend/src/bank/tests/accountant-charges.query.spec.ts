import type { EntityManager } from 'typeorm';
import { AccountantChargesQuery, PREVIEW_MAX_ROWS } from '../accountant-charges.query.js';
import { ORGANIZATION, PERSONAL } from './account.test-support.js';

function setup(result: unknown[] = []) {
  const repository = { query: jest.fn(async () => result) };
  const manager = { query: jest.fn(async () => result) };
  const query = new AccountantChargesQuery(repository as never);

  return { query, repository, manager, asManager: manager as unknown as EntityManager };
}

const SENT_AT = new Date('2026-11-09T12:00:00Z');

describe('AccountantChargesQuery', () => {
  describe('preview', () => {
    it('filters by the personal owner, provider type, flag, sign, range and unsent marks', async () => {
      const { query, repository } = setup();

      await query.preview(PERSONAL, '2026-10-01', '2026-10-31', false);

      const [sql, params] = repository.query.mock.calls[0] as unknown as [string, unknown[]];
      expect(sql).toContain('a.user_id = ? AND a.organization_id IS NULL');
      expect(sql).toContain("a.type = 'provider_expense'");
      expect(sql).toContain('d.for_accountant = 1');
      expect(sql).toContain('t.amount < 0');
      expect(sql).toContain('t.date BETWEEN ? AND ?');
      expect(sql).toContain('t.sent_to_accountant_at IS NULL');
      expect(sql).toContain('ORDER BY t.date, t.id');
      expect(sql).toContain(`LIMIT ${PREVIEW_MAX_ROWS + 1}`);
      expect(sql).not.toContain('archived_at');
      expect(sql).not.toContain('opening_date');
      expect(params).toEqual([7, '2026-10-01', '2026-10-31']);
    });

    it('filters by the organization owner and keeps sent charges with include_sent', async () => {
      const { query, repository } = setup();

      await query.preview(ORGANIZATION, '2026-10-01', '2026-10-31', true);

      const [sql, params] = repository.query.mock.calls[0] as unknown as [string, unknown[]];
      expect(sql).toContain('a.user_id IS NULL AND a.organization_id = ?');
      expect(sql).not.toContain('sent_to_accountant_at IS NULL');
      expect(params[0]).toBe(3);
    });

    it('maps the raw rows (bigint amounts, Date marks)', async () => {
      const { query } = setup([
        {
          id: '7',
          date: '2026-10-05',
          description: 'Charge',
          amount: '-12990',
          sent_to_accountant_at: SENT_AT,
          account_id: '12',
          account_name: 'Vivo Fibra',
          bank_name: 'Vivo',
          provider_tax_id: '02.558.157/0001-62',
          currency: 'BRL',
        },
        {
          id: 8,
          date: '2026-10-06',
          description: 'Charge',
          amount: -1,
          sent_to_accountant_at: null,
          account_id: 12,
          account_name: 'Vivo Fibra',
          bank_name: null,
          provider_tax_id: null,
          currency: 'BRL',
        },
      ]);

      await expect(query.preview(PERSONAL, '2026-10-01', '2026-10-31', true)).resolves.toEqual([
        {
          id: 7,
          date: '2026-10-05',
          description: 'Charge',
          amount: -12990n,
          sentToAccountantAt: SENT_AT,
          accountId: 12,
          accountName: 'Vivo Fibra',
          bankName: 'Vivo',
          providerTaxId: '02.558.157/0001-62',
          currency: 'BRL',
        },
        expect.objectContaining({ id: 8, amount: -1n, sentToAccountantAt: null, bankName: null, providerTaxId: null }),
      ]);
    });
  });

  describe('resolveForUpdate', () => {
    it('runs one owner-scoped query on the given manager, locking only the transaction rows', async () => {
      const { query, manager, asManager } = setup();

      await query.resolveForUpdate(asManager, ORGANIZATION, [7, 9]);

      expect(manager.query).toHaveBeenCalledTimes(1);
      const [sql, params] = manager.query.mock.calls[0] as unknown as [string, unknown[]];
      expect(sql).toContain('t.id IN (?, ?)');
      expect(sql).toContain('a.user_id IS NULL AND a.organization_id = ?');
      expect(sql).toContain('LEFT JOIN bank_provider_expense_details d');
      expect(sql).toMatch(/FOR UPDATE OF t\s*$/);
      expect(params).toEqual([7, 9, 3]);
    });

    it('maps the flag of provider accounts and null for other types', async () => {
      const { query, asManager } = setup([
        { id: '7', amount: '-100', sent_to_accountant_at: null, type: 'provider_expense', for_accountant: 1 },
        { id: 8, amount: -5, sent_to_accountant_at: '2026-11-09T12:00:00Z', type: 'provider_expense', for_accountant: '0' },
        { id: 9, amount: '100', sent_to_accountant_at: null, type: 'regular', for_accountant: null },
      ]);

      await expect(query.resolveForUpdate(asManager, PERSONAL, [7, 8, 9])).resolves.toEqual([
        { id: 7, amount: -100n, sentToAccountantAt: null, type: 'provider_expense', forAccountant: true },
        { id: 8, amount: -5n, sentToAccountantAt: SENT_AT, type: 'provider_expense', forAccountant: false },
        { id: 9, amount: 100n, sentToAccountantAt: null, type: 'regular', forAccountant: null },
      ]);
    });
  });

  describe('stamp / clear', () => {
    it('stamps only the unsent rows, keeping original timestamps', async () => {
      const { query, manager, asManager } = setup();

      await query.stamp(asManager, [7, 9], SENT_AT);

      const [sql, params] = manager.query.mock.calls[0] as unknown as [string, unknown[]];
      expect(sql).toContain('SET sent_to_accountant_at = ?');
      expect(sql).toContain('WHERE id IN (?, ?) AND sent_to_accountant_at IS NULL');
      expect(params).toEqual([SENT_AT, 7, 9]);
    });

    it('clears the mark of the ids', async () => {
      const { query, manager, asManager } = setup();

      await query.clear(asManager, [7]);

      expect(manager.query).toHaveBeenCalledWith(
        'UPDATE bank_transactions SET sent_to_accountant_at = NULL WHERE id IN (?)',
        [7],
      );
    });
  });
});
