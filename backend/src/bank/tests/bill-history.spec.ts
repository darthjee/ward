import { buildAccount, PERSONAL } from './account.test-support.js';
import { BillHistoryService } from '../bill-history.service.js';
import { billSourceOf } from '../bill-schedule.js';
import { BillSourceResolver } from '../bill-source.resolver.js';
import { BillPayment } from '../entities/bill-payment.entity.js';

const loan = buildAccount({ id: 3, type: 'debt', archivedAt: new Date() });
const source = billSourceOf(loan, { dueDay: 10, billsFrom: '2026-01-01', showInCalendar: false, instalmentFrequency: 'monthly' });

const row = (fields: Partial<BillPayment>): BillPayment => Object.assign(new BillPayment(), {
  id: 1,
  sourceAccountId: 3,
  billId: null,
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

describe('BillSourceResolver', () => {
  it.each([
    ['an unknown account', null],
    ['a regular account', buildAccount({ type: 'regular' })],
  ])('answers the uniform 404 for %s', async (_label, account) => {
    const resolver = new BillSourceResolver({ findOneBy: async () => account } as never, {} as never);

    await expect(resolver.resolve(PERSONAL, 1)).rejects.toMatchObject({ status: 404 });
  });
});
