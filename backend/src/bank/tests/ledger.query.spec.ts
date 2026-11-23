import { LedgerQuery } from '../ledger.query.js';
import { buildAccount } from './account.test-support.js';

function setup(rows: unknown[]) {
  const repository = { query: jest.fn(async () => rows) };

  return { ledger: new LedgerQuery(repository as never), repository };
}

const RAW_ROW = {
  id: '7',
  date: '2026-11-02',
  amount: '-1250',
  description: 'x',
  notes: null,
  sent_to_accountant_at: null,
  payment_generated: '1',
  reconciliation_id: null,
  reconciliation_reconciled_at: null,
  reconciliation_statement_date: null,
  cumulative: '-1250',
  before_anchor: '0',
};

describe('LedgerQuery#page', () => {
  it('computes payment_generated with an owner-scoped EXISTS, its params before the anchor', async () => {
    const { ledger, repository } = setup([]);
    const account = buildAccount({ id: 4, openingDate: '2026-10-01' });

    await ledger.page({ kind: 'organization', organizationId: 3 }, account, 2, 50);

    expect(repository.query).toHaveBeenCalledTimes(1);
    const [sql, params] = (repository.query.mock.calls[0] as unknown) as [string, unknown[]];
    expect(sql).toMatch(/EXISTS \(/);
    expect(sql).toMatch(/JOIN bank_accounts a ON a\.id = p\.source_account_id/);
    expect(sql).toMatch(/p\.payment_transaction_id = t\.id OR p\.withdrawal_transaction_id = t\.id OR p\.charge_transaction_id = t\.id/);
    expect(sql).toMatch(/a\.user_id IS NULL AND a\.organization_id = \?/);
    expect(sql).toMatch(/\) AS payment_generated/);
    expect(params).toEqual([3, '2026-10-01', 4, 50, 50]);
  });

  it('maps the flag to a boolean', async () => {
    const { ledger } = setup([RAW_ROW, { ...RAW_ROW, id: '6', payment_generated: 0 }]);

    const rows = await ledger.page({ kind: 'user', userId: 7 }, buildAccount({ openingBalance: 0n }), 1, 50);

    expect(rows.map((row) => row.paymentGenerated)).toEqual([true, false]);
  });
});

describe('LedgerQuery#page reconciliation', () => {
  const owner = { kind: 'user', userId: 7 } as const;

  it('joins the statement outside the window subquery, scoped to the row account', async () => {
    const { ledger, repository } = setup([]);

    await ledger.page(owner, buildAccount({ id: 4 }), 1, 50);

    const [sql] = (repository.query.mock.calls[0] as unknown) as [string];
    expect(sql).toMatch(/t\.reconciliation_id, t\.account_id/);
    expect(sql).toMatch(/\) ledger\s+LEFT JOIN bank_reconciliations r ON r\.id = ledger\.reconciliation_id AND r\.account_id = ledger\.account_id/);
    expect(sql).toMatch(/ORDER BY ledger\.sort_date DESC, ledger\.id DESC\s+LIMIT \? OFFSET \?/);
  });

  it('maps an uncleared row to null, an open statement and a finished statement', async () => {
    const { ledger } = setup([
      RAW_ROW,
      { ...RAW_ROW, id: '6', reconciliation_id: '3', reconciliation_statement_date: '2026-10-31' },
      {
        ...RAW_ROW,
        id: '5',
        reconciliation_id: 2,
        reconciliation_reconciled_at: new Date('2026-11-01T10:00:00Z'),
        reconciliation_statement_date: '2026-09-30',
      },
    ]);

    const rows = await ledger.page(owner, buildAccount({ openingBalance: 0n }), 1, 50);

    expect(rows.map((row) => row.reconciliation)).toEqual([
      null,
      { id: 3, status: 'open', statementDate: '2026-10-31' },
      { id: 2, status: 'finished', statementDate: '2026-09-30' },
    ]);
  });
});

describe('LedgerQuery#lastReconciledDate', () => {
  it('returns the latest finished statement date', async () => {
    const { ledger, repository } = setup([{ last: '2026-10-31' }]);

    await expect(ledger.lastReconciledDate(4)).resolves.toBe('2026-10-31');

    const [sql, params] = (repository.query.mock.calls[0] as unknown) as [string, unknown[]];
    expect(sql).toMatch(/FROM bank_reconciliations WHERE account_id = \? AND reconciled_at IS NOT NULL/);
    expect(params).toEqual([4]);
  });

  it('returns null when the account has no finished statement', async () => {
    const { ledger } = setup([{ last: null }]);

    await expect(ledger.lastReconciledDate(4)).resolves.toBeNull();
  });
});
