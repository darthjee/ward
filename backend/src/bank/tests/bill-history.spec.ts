import { buildAccount, PERSONAL } from './account.test-support.js';
import { BillHistoryService } from '../bill-history.service.js';
import { billSourceOf } from '../bill-schedule.js';
import { BillSourceResolver } from '../bill-source.resolver.js';
import { BillPayment } from '../entities/bill-payment.entity.js';
import { ProviderBill } from '../entities/provider-bill.entity.js';

const loan = buildAccount({ id: 3, type: 'debt', archivedAt: new Date() });
const source = billSourceOf(loan, { dueDay: 10, billsFrom: '2026-01-01', showInCalendar: false, instalmentFrequency: 'monthly' });

const row = (fields: Partial<BillPayment>): BillPayment => Object.assign(new BillPayment(), {
  id: 1,
  sourceAccountId: 3,
  billId: null,
  providerBillId: null,
  dueDate: '2026-01-10',
  status: 'skipped',
  paidOn: null,
  amount: null,
  payingAccountId: null,
  ...fields,
});

describe('BillHistoryService', () => {
  it('flags off-schedule derived rows against the schedule pattern, ignoring archived / hidden flags', async () => {
    const findAndCount = jest.fn(async () => [[
      row({ id: 1, dueDate: '2026-01-10' }),
      row({ id: 2, dueDate: '2026-01-11' }),
      row({ id: 3, dueDate: '2025-12-10' }),
      row({ id: 4, dueDate: '2026-01-11', billId: 8 }),
    ], 4]);
    const manager = { getRepository: () => ({ find: async () => [] }) };
    const service = new BillHistoryService(
      { findAndCount, manager } as never,
      { find: async () => [{ id: 8, description: 'Fine' }] } as never,
      { resolve: async () => source } as never,
      {} as never,
    );

    const result = await service.history(PERSONAL, 3, 1);

    expect(result.payments.map(({ id, off_schedule: off, bill }) => [id, off, bill])).toEqual([
      [1, false, null],
      [2, true, null],
      [3, true, null],
      [4, false, { id: 8, description: 'Fine' }],
    ]);
    expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { sourceAccountId: 3 }, skip: 0, take: 50 }));
  });
});

describe('BillHistoryService per provider bill', () => {
  const fee = buildAccount({ id: 4, type: 'provider_expense' });
  const recurring = (id: number, dueDay: number, description: string) => Object.assign(new ProviderBill(), {
    id, providerAccountId: 4, kind: 'recurring', description, notes: 'secret', chargeFrequency: 'monthly', dueDay, billsFrom: '2026-01-01', showInCalendar: true,
  });
  const billA = recurring(21, 5, 'Plan A');
  const billB = recurring(22, 15, 'Plan B');
  const oneOff = Object.assign(new ProviderBill(), { id: 30, providerAccountId: 4, kind: 'one_off', description: 'Fix', dueDate: '2026-01-20' });
  const build = (payments: BillPayment[], peeked: ProviderBill = billA) => {
    const findAndCount = jest.fn(async () => [payments, payments.length]);
    const find = jest.fn(async () => [billA, billB, oneOff]);
    const peek = jest.fn(async () => ({ bill: peeked, provider: fee }));
    const service = new BillHistoryService(
      { findAndCount, manager: { getRepository: () => ({ find: async () => [] }) } } as never,
      { find } as never,
      {} as never,
      { peek } as never,
    );

    return { service, findAndCount, find, peek };
  };

  it('pages one recurring bill, with its own off_schedule and source_bill, never notes', async () => {
    const { service, findAndCount, peek } = build([
      row({ id: 1, sourceAccountId: 4, providerBillId: 21, dueDate: '2026-02-05' }),
      row({ id: 2, sourceAccountId: 4, providerBillId: 21, dueDate: '2026-02-06' }),
    ]);

    const result = await service.historyForBill(PERSONAL, 21, 1);

    expect(peek).toHaveBeenCalledWith(PERSONAL, 21, undefined, { allowArchived: true });
    expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { providerBillId: 21 } }));
    expect(result.payments.map(({ off_schedule: off, bill, source_bill: sourceBill }) => [off, bill, sourceBill]))
      .toEqual([[false, null, { id: 21, description: 'Plan A' }], [true, null, { id: 21, description: 'Plan A' }]]);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('pages a one-off bill by bill id, never off schedule', async () => {
    const { service, findAndCount } = build([row({ id: 3, sourceAccountId: 4, billId: 30, dueDate: '2026-01-20' })], oneOff);

    const result = await service.historyForBill(PERSONAL, 30, 1);

    expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { billId: 30 } }));
    expect(result.payments[0]).toMatchObject({ off_schedule: false, bill: { id: 30 }, source_bill: { id: 30, description: 'Fix' } });
  });
});

describe('BillSourceResolver', () => {
  it.each([
    ['an unknown account', null],
    ['a regular account', buildAccount({ type: 'regular' })],
    ['a provider account (paid and listed per bill)', buildAccount({ type: 'provider_expense' })],
  ])('answers the uniform 404 for %s', async (_label, account) => {
    const resolver = new BillSourceResolver({ findOneBy: async () => account } as never, {} as never);

    await expect(resolver.resolve(PERSONAL, 1)).rejects.toMatchObject({ status: 404 });
  });
});
