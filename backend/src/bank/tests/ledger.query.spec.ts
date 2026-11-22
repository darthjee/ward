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
