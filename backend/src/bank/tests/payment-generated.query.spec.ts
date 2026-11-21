import { PaymentGeneratedQuery } from '../payment-generated.query.js';

function setup(rows: unknown[]) {
  const repository = { query: jest.fn(async () => rows) };

  return { query: new PaymentGeneratedQuery(repository as never), repository };
}

describe('PaymentGeneratedQuery', () => {
  it('runs one EXISTS joined to the source account, scoped by an organization owner', async () => {
    const { query, repository } = setup([{ found: '1' }]);

    await expect(query.isPaymentGenerated({ kind: 'organization', organizationId: 3 }, 5)).resolves.toBe(true);

    expect(repository.query).toHaveBeenCalledTimes(1);
    const [sql, params] = (repository.query.mock.calls[0] as unknown) as [string, unknown[]];
    expect(sql).toMatch(/SELECT EXISTS/);
    expect(sql).toMatch(/JOIN bank_accounts a ON a\.id = p\.source_account_id/);
    expect(sql).toMatch(/p\.payment_transaction_id = \? OR p\.withdrawal_transaction_id = \? OR p\.charge_transaction_id = \?/);
    expect(sql).toMatch(/a\.user_id IS NULL AND a\.organization_id = \?/);
    expect(params).toEqual([5, 5, 5, 3]);
  });

  it('scopes a personal owner by user_id', async () => {
    const { query, repository } = setup([{ found: 0 }]);

    await expect(query.isPaymentGenerated({ kind: 'user', userId: 7 }, 9)).resolves.toBe(false);

    const [sql, params] = (repository.query.mock.calls[0] as unknown) as [string, unknown[]];
    expect(sql).toMatch(/a\.user_id = \? AND a\.organization_id IS NULL/);
    expect(params).toEqual([9, 9, 9, 7]);
  });

  it('answers false on an empty result', async () => {
    const { query } = setup([]);

    await expect(query.isPaymentGenerated({ kind: 'user', userId: 7 }, 9)).resolves.toBe(false);
  });
});
