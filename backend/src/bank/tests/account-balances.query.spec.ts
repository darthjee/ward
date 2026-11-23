import { AccountBalancesQuery } from '../account-balances.query.js';
import { Account } from '../entities/account.entity.js';
import { Reconciliation } from '../entities/reconciliation.entity.js';
import { buildAccount } from './account.test-support.js';

function fakeRepository(rows: unknown[], row?: unknown) {
  const builder = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(async () => rows),
    getRawOne: jest.fn(async () => row),
  };

  return {
    builder,
    repository: { createQueryBuilder: jest.fn(() => builder), existsBy: jest.fn(async () => true) },
  };
}

describe('AccountBalancesQuery', () => {
  it('computes every balance with one grouped query', async () => {
    const { builder, repository } = fakeRepository([
      { accountId: 1, total: '-2500' },
      { accountId: '2', total: '100' },
    ]);
    const query = new AccountBalancesQuery(repository as never);
    const accounts = [
      buildAccount({ id: 1, openingBalance: 10000n }),
      buildAccount({ id: 2, openingBalance: 0n }),
      buildAccount({ id: 3, openingBalance: 5n }),
    ];

    const balances = await query.currentBalances(accounts);

    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(builder.getRawMany).toHaveBeenCalledTimes(1);
    expect(builder.where).toHaveBeenCalledWith('t.account_id IN (:...ids)', { ids: [1, 2, 3] });
    expect(builder.andWhere).toHaveBeenCalledWith('t.date >= a.opening_date');
    expect(builder.groupBy).toHaveBeenCalledWith('t.account_id');
    expect(balances).toEqual(new Map([[1, 7500n], [2, 100n], [3, 5n]]));
  });

  it('runs no query for no accounts', async () => {
    const { repository } = fakeRepository([]);

    await expect(new AccountBalancesQuery(repository as never).currentBalances([])).resolves.toEqual(new Map());
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('treats a null SUM as zero', async () => {
    const { repository } = fakeRepository([{ accountId: 1, total: null }]);

    await expect(
      new AccountBalancesQuery(repository as never).currentBalance(buildAccount({ id: 1, openingBalance: 9n })),
    ).resolves.toBe(9n);
  });

  it('checks for transactions by account id', async () => {
    const { repository } = fakeRepository([]);

    await expect(new AccountBalancesQuery(repository as never).hasTransactions(4)).resolves.toBe(true);
    expect(repository.existsBy).toHaveBeenCalledWith({ accountId: 4 });
  });

  describe('clearedBalance', () => {
    it('adds the finished-statement sum to the opening balance, scoped to the account and its anchor', async () => {
      const { builder, repository } = fakeRepository([], { total: '-2500' });
      const query = new AccountBalancesQuery(repository as never);

      await expect(query.clearedBalance(buildAccount({ id: 4, openingBalance: 10000n }))).resolves.toBe(7500n);

      expect(builder.innerJoin).toHaveBeenCalledWith(Account, 'a', 'a.id = t.account_id');
      expect(builder.innerJoin).toHaveBeenCalledWith(
        Reconciliation,
        'r',
        'r.id = t.reconciliation_id AND r.account_id = t.account_id AND r.reconciled_at IS NOT NULL',
      );
      expect(builder.select).toHaveBeenCalledWith('SUM(t.amount)', 'total');
      expect(builder.where).toHaveBeenCalledWith('t.account_id = :account', { account: 4 });
      expect(builder.andWhere).toHaveBeenCalledWith('t.date >= a.opening_date');
    });

    it('is the opening balance when nothing is cleared (NULL SUM)', async () => {
      const { repository } = fakeRepository([], { total: null });

      await expect(
        new AccountBalancesQuery(repository as never).clearedBalance(buildAccount({ id: 4, openingBalance: 9n })),
      ).resolves.toBe(9n);
    });
  });

  describe('tickedSum', () => {
    it('sums the transactions ticked on the statement, scoped to the account', async () => {
      const { builder, repository } = fakeRepository([], { total: '300' });

      await expect(new AccountBalancesQuery(repository as never).tickedSum(4, 8)).resolves.toBe(300n);

      expect(builder.where).toHaveBeenCalledWith('t.reconciliation_id = :open', { open: 8 });
      expect(builder.andWhere).toHaveBeenCalledWith('t.account_id = :account', { account: 4 });
    });

    it('is 0n for a NULL SUM', async () => {
      const { repository } = fakeRepository([], { total: null });

      await expect(new AccountBalancesQuery(repository as never).tickedSum(4, 8)).resolves.toBe(0n);
    });
  });
});
