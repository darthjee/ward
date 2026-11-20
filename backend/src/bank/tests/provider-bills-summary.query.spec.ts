import { ProviderBillsSummaryQuery } from '../provider-bills-summary.query.js';

function fakeRepository(rows: unknown[]) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(async () => rows),
  };

  return { builder, repository: { createQueryBuilder: jest.fn(() => builder) } };
}

describe('ProviderBillsSummaryQuery', () => {
  it('summarises every account with one grouped query, defaulting missing ids and null sums to zero', async () => {
    const { builder, repository } = fakeRepository([
      { providerAccountId: 1, count: '3', monthly: '25000', yearly: '120000' },
      { providerAccountId: '2', count: 1, monthly: null, yearly: null },
    ]);

    const summaries = await new ProviderBillsSummaryQuery(repository as never).summaries([1, 2, 3]);

    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(builder.getRawMany).toHaveBeenCalledTimes(1);
    expect(builder.where).toHaveBeenCalledWith('b.provider_account_id IN (:...ids)', { ids: [1, 2, 3] });
    expect(builder.groupBy).toHaveBeenCalledWith('b.provider_account_id');
    expect(summaries).toEqual(new Map([
      [1, { count: 3, monthly: 25000n, yearly: 120000n }],
      [2, { count: 1, monthly: 0n, yearly: 0n }],
      [3, { count: 0, monthly: 0n, yearly: 0n }],
    ]));
  });

  it('runs no query for no accounts', async () => {
    const { repository } = fakeRepository([]);

    await expect(new ProviderBillsSummaryQuery(repository as never).summaries([])).resolves.toEqual(new Map());
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
