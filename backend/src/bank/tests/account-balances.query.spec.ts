import { AccountBalancesQuery } from '../account-balances.query.js';
import { buildAccount } from './account.test-support.js';

function fakeRepository(rows: unknown[]) {
  const builder = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(async () => rows),
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
});
