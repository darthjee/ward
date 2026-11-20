import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from './test-data-source.js';
import { Account } from '../../../bank/entities/account.entity.js';
import { ProviderBill } from '../../../bank/entities/provider-bill.entity.js';
import { ProviderBillsSummaryQuery } from '../../../bank/provider-bills-summary.query.js';

describe('provider bills summary (MySQL)', () => {
  let ds: DataSource;
  let accounts: Repository<Account>;
  let bills: Repository<ProviderBill>;
  let query: ProviderBillsSummaryQuery;

  const insertProvider = (name: string): Promise<Account> => accounts.save(accounts.create({
    userId: 1,
    organizationId: null,
    type: 'provider_expense',
    name,
    currency: 'BRL',
    openingDate: '2026-01-01',
    openingBalance: 0n,
    archivedAt: null,
  }));
  const insertRecurring = (providerAccountId: number, description: string, fields: Partial<ProviderBill> = {}) =>
    bills.save(bills.create({
      providerAccountId,
      kind: 'recurring',
      description,
      dueDay: 5,
      chargeFrequency: 'monthly',
      billsFrom: '2026-01-01',
      showInCalendar: true,
      expectedAmount: null,
      ...fields,
    }));
  const insertOneOff = (providerAccountId: number, description: string, expectedAmount: bigint) =>
    bills.save(bills.create({ providerAccountId, kind: 'one_off', description, dueDate: '2026-03-10', expectedAmount }));

  beforeAll(async () => {
    ds = await createTestDataSource();
    accounts = ds.getRepository(Account);
    bills = ds.getRepository(ProviderBill);
    query = new ProviderBillsSummaryQuery(bills);
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('counts every bill and sums only recurring amounts per frequency, grouped by provider', async () => {
    const first = await insertProvider('First');
    const second = await insertProvider('Second');
    const empty = await insertProvider('Empty');
    await insertRecurring(first.id, 'Fee', { expectedAmount: 10000n });
    await insertRecurring(first.id, 'Support', { expectedAmount: 15000n });
    await insertRecurring(first.id, 'Variable');
    await insertRecurring(first.id, 'Tax', { chargeFrequency: 'yearly', dueMonth: 3, expectedAmount: 120000n });
    await insertOneOff(first.id, 'Setup', 1000n);
    await insertOneOff(second.id, 'Setup', 500n);
    await insertRecurring(second.id, 'Variable');

    const summaries = await query.summaries([first.id, second.id, empty.id, 999]);

    expect(summaries).toEqual(new Map([
      [first.id, { count: 5, monthly: 25000n, yearly: 120000n }],
      [second.id, { count: 2, monthly: 0n, yearly: 0n }],
      [empty.id, { count: 0, monthly: 0n, yearly: 0n }],
      [999, { count: 0, monthly: 0n, yearly: 0n }],
    ]));
  });

  it('only reads the given providers', async () => {
    const first = await insertProvider('First');
    const other = await insertProvider('Other');
    await insertRecurring(other.id, 'Fee', { expectedAmount: 10000n });

    expect(await query.summaries([first.id])).toEqual(new Map([[first.id, { count: 0, monthly: 0n, yearly: 0n }]]));
  });

  it('answers an empty map for an empty id list', async () => {
    await expect(query.summaries([])).resolves.toEqual(new Map());
  });
});
