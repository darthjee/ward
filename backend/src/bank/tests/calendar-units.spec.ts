import { buildAccount, PERSONAL } from './account.test-support.js';
import { billSourceOf, billSourceOfProviderBill } from '../bill-schedule.js';
import { calendarTotals, overdueTotals } from '../calendar-totals.js';
import { CalendarQuery } from '../calendar.query.js';
import { CalendarService } from '../calendar.service.js';
import { BillPayment } from '../entities/bill-payment.entity.js';
import { ProviderBill } from '../entities/provider-bill.entity.js';
import { billInput, buildOccurrence, compareOccurrences, derivedInput, type OccurrenceView } from '../occurrence-response.js';

const TODAY = '2026-06-15';
const debtAccount = buildAccount({ id: 3, type: 'debt', name: 'Loan' });
const providerAccount = buildAccount({ id: 4, type: 'provider_expense', name: 'Fee' });

const debtSource = billSourceOf(debtAccount, {
  instalmentFrequency: 'monthly',
  dueDay: 10,
  dueMonth: null,
  billsFrom: '2026-01-01',
  showInCalendar: true,
  instalmentAmount: 50000n,
  payingAccount: { id: 9, name: 'Checking' },
});

const payment = (fields: Partial<BillPayment> = {}): BillPayment => Object.assign(new BillPayment(), {
  id: 1,
  sourceAccountId: 3,
  billId: null,
  providerBillId: null,
  dueDate: '2026-06-10',
  status: 'paid',
  paidOn: '2026-06-10',
  amount: 49000n,
  payingAccountId: 9,
  ...fields,
});

const bill = (fields: Partial<ProviderBill> = {}): ProviderBill => Object.assign(new ProviderBill(), {
  id: 7,
  providerAccountId: 4,
  payingAccountId: null,
  kind: 'one_off',
  dueDate: '2026-06-20',
  expectedAmount: 1000n,
  description: 'Repair',
  notes: null,
  ...fields,
});

const view = (currency: string, status: string, expected: bigint | null, paid: bigint | null = null): OccurrenceView =>
  ({ response: { currency, status }, expected, paid }) as unknown as OccurrenceView;

describe('billSourceOf', () => {
  it('reads the debt schedule, instalment amount and default paying account', () => {
    expect(debtSource).toMatchObject({
      kind: 'debt',
      expected: 50000n,
      defaultPayingAccount: { id: 9, name: 'Checking' },
      schedule: { frequency: 'monthly', dueDay: 10, billsFrom: '2026-01-01', showInCalendar: true, archived: false },
    });
  });

  it('falls back to defaults without a details row and flags archived accounts', () => {
    expect(billSourceOf(buildAccount({ type: 'debt', archivedAt: new Date() }), undefined).schedule).toEqual({
      frequency: 'monthly',
      dueDay: null,
      dueMonth: null,
      billsFrom: null,
      showInCalendar: true,
      archived: true,
    });
  });
});

describe('buildOccurrence', () => {
  const refs = new Map([[9, { id: 9, name: 'Checking' }]]);

  it('derives open / overdue from the effective date against today', () => {
    const dueToday = buildOccurrence(derivedInput(debtSource, { nominal: '2026-06-13', effective: '2026-06-15' }, undefined), refs, TODAY);
    const before = buildOccurrence(derivedInput(debtSource, { nominal: '2026-06-10', effective: '2026-06-14' }, undefined), refs, TODAY);

    expect(dueToday.response.status).toBe('open');
    expect(before.response.status).toBe('overdue');
  });

  it('takes paid / skipped from the payment row', () => {
    const paid = buildOccurrence(derivedInput(debtSource, { nominal: '2026-06-10', effective: '2026-06-10' }, payment()), refs, TODAY);
    const skipped = buildOccurrence(
      derivedInput(debtSource, { nominal: '2026-06-10', effective: '2026-06-10' }, payment({ status: 'skipped', amount: null, paidOn: null, payingAccountId: null })),
      refs,
      TODAY,
    );

    expect(paid.response).toMatchObject({
      status: 'paid',
      payment: { id: 1, status: 'paid', paid_on: '2026-06-10', amount: '490.00', paying_account: { id: 9, name: 'Checking' } },
    });
    expect(paid.paid).toBe(49000n);
    expect(skipped.response).toMatchObject({ status: 'skipped', payment: { amount: null, paying_account: null } });
    expect(skipped.paid).toBeNull();
  });

  it('builds a one-off bill with no shift and its own default paying account', () => {
    const occurrence = buildOccurrence(billInput(bill({ payingAccountId: 9 }), providerAccount, undefined, refs), refs, TODAY);

    expect(occurrence.response).toEqual({
      kind: 'bill',
      source_account: { id: 4, name: 'Fee', type: 'provider_expense' },
      bill: { id: 7, description: 'Repair' },
      source_bill: { id: 7, description: 'Repair' },
      nominal_date: '2026-06-20',
      effective_date: '2026-06-20',
      expected_amount: '10.00',
      currency: 'BRL',
      status: 'open',
      payment: null,
      default_paying_account: { id: 9, name: 'Checking' },
    });
  });

  it('answers a null paying account once it was deleted', () => {
    const occurrence = buildOccurrence(derivedInput(debtSource, { nominal: '2026-06-10', effective: '2026-06-10' }, payment({ payingAccountId: 99 })), refs, TODAY);

    expect(occurrence.response.payment?.paying_account).toBeNull();
  });
});

describe('compareOccurrences', () => {
  const entry = (effective: string, kind: string, sourceId: number, billId: number | null, sourceBillId: number | null = null) =>
    ({ response: {
      effective_date: effective,
      kind,
      source_account: { id: sourceId },
      bill: billId === null ? null : { id: billId },
      source_bill: sourceBillId === null ? null : { id: sourceBillId },
    } }) as unknown as OccurrenceView;

  it('breaks ties between two bills of one provider by source bill id', () => {
    const rows = [entry('2026-01-12', 'provider', 4, null, 22), entry('2026-01-12', 'provider', 4, null, 21)];

    expect(rows.sort(compareOccurrences).map(({ response }) => response.source_bill?.id)).toEqual([21, 22]);
  });

  it('sorts by effective date, then kind, source account id and bill id', () => {
    const rows = [
      entry('2026-01-12', 'provider', 1, null),
      entry('2026-01-12', 'debt', 5, null),
      entry('2026-01-12', 'debt', 2, null),
      entry('2026-01-12', 'bill', 1, 9),
      entry('2026-01-12', 'bill', 1, 3),
      entry('2026-01-11', 'provider', 9, null),
    ];

    expect(rows.sort(compareOccurrences).map(({ response }) => [response.kind, response.source_account.id, response.bill?.id ?? null]))
      .toEqual([['provider', 9, null], ['bill', 1, 3], ['bill', 1, 9], ['debt', 2, null], ['debt', 5, null], ['provider', 1, null]]);
  });
});

describe('calendar totals', () => {
  it('sums expected, paid and open per currency, skipping null expected amounts and skipped occurrences', () => {
    const views = [
      view('BRL', 'open', 1000n),
      view('BRL', 'overdue', 500n),
      view('BRL', 'paid', 700n, 650n),
      view('BRL', 'skipped', 300n),
      view('BRL', 'open', null),
      view('BRL', 'paid', null, 100n),
      view('JPY', 'open', 50n),
    ];

    expect(calendarTotals(views)).toEqual([
      { currency: 'BRL', expected: '25.00', paid: '7.50', open: '15.00' },
      { currency: 'JPY', expected: '50', paid: '0', open: '50' },
    ]);
    expect(overdueTotals(views)).toEqual([{ currency: 'BRL', open: '15.00' }, { currency: 'JPY', open: '50' }]);
  });

  it('answers [] for no occurrences', () => {
    expect(calendarTotals([])).toEqual([]);
    expect(overdueTotals([])).toEqual([]);
  });
});

describe('CalendarQuery', () => {
  const setup = () => {
    const accountFind = jest.fn(async () => [debtAccount, providerAccount, buildAccount({ id: 5, type: 'debt' })]);
    const billFind = jest.fn(async () => [
      bill({ id: 21, providerAccountId: 4, kind: 'recurring', dueDate: null, chargeFrequency: 'monthly', dueDay: 5, billsFrom: '2026-01-01', showInCalendar: true }),
      bill({ id: 22, providerAccountId: 4, kind: 'recurring', dueDate: null, chargeFrequency: 'monthly', dueDay: 6, billsFrom: '2026-01-01', showInCalendar: true }),
      bill({ id: 23, providerAccountId: 4, kind: 'recurring', dueDate: null, chargeFrequency: 'monthly', dueDay: null, billsFrom: '2026-01-01', showInCalendar: true }),
      bill({ id: 24, providerAccountId: 4, kind: 'recurring', dueDate: null, chargeFrequency: 'monthly', dueDay: 7, billsFrom: '2026-01-01', showInCalendar: false }),
    ]);
    const paymentFind = jest.fn(async () => []);
    const manager = { getRepository: jest.fn(() => ({ find: jest.fn(async () => []) })) };
    const registry = {
      loadDetails: jest.fn(async () => new Map<number, unknown>([
        [3, { dueDay: 10, billsFrom: '2026-01-01', showInCalendar: true }],
        [4, { dueDay: 5, billsFrom: '2026-01-01', showInCalendar: false }],
      ])),
    };
    const query = new CalendarQuery(
      { find: accountFind, manager } as never,
      { find: billFind } as never,
      { find: paymentFind } as never,
      registry as never,
    );

    return { query, accountFind, billFind, paymentFind };
  };

  it('builds one provider source per active recurring bill, plus the debts', async () => {
    const { query, billFind } = setup();

    const { scheduled } = await query.sources(PERSONAL);

    expect(billFind).toHaveBeenCalledTimes(1);
    expect(scheduled.map(({ account, bill }) => [account.id, bill?.id ?? null])).toEqual([[3, null], [4, 21], [4, 22]]);
  });

  it('keeps only scheduled, shown sources and lists the active providers', async () => {
    const { query, accountFind } = setup();

    const { scheduled, providers } = await query.sources(PERSONAL);

    expect(accountFind).toHaveBeenCalledWith({ where: expect.objectContaining({ userId: 7, archivedAt: expect.anything() }) });
    expect(scheduled.map(({ account }) => account.id)).toEqual([3, 4, 4]);
    expect([...providers.keys()]).toEqual([4]);
  });

  it('skips the bill and payment reads when there is nothing to read', async () => {
    const { query, billFind, paymentFind } = setup();

    await expect(query.bills([], {} as never)).resolves.toEqual([]);
    billFind.mockClear();
    await expect(query.payments([], [], [], {} as never)).resolves.toEqual([]);
    expect(billFind).not.toHaveBeenCalled();
    expect(paymentFind).not.toHaveBeenCalled();
  });

  it('reads derived and one-off payments in one query', async () => {
    const { query, paymentFind } = setup();

    await query.payments([3], [11], [7], 'dates' as never);

    expect(paymentFind).toHaveBeenCalledTimes(1);
    expect(paymentFind).toHaveBeenCalledWith({
      where: [
        expect.objectContaining({ dueDate: 'dates', providerBillId: expect.anything() }),
        expect.objectContaining({ providerBillId: expect.anything(), dueDate: 'dates' }),
        expect.objectContaining({ billId: expect.anything() }),
      ],
    });
  });
});

describe('source_bill', () => {
  const recurring = bill({ id: 21, kind: 'recurring', dueDate: null, description: 'Plan', notes: 'secret', chargeFrequency: 'monthly', dueDay: 5, billsFrom: '2026-01-01' });
  const providerSource = billSourceOfProviderBill(recurring, providerAccount, null);
  const refs = new Map();

  it('names the recurring bill, the one-off bill, and is null for debts', () => {
    const nominal = { nominal: '2026-06-05', effective: '2026-06-05' };

    expect(buildOccurrence(derivedInput(providerSource, nominal, undefined), refs, TODAY).response.source_bill).toEqual({ id: 21, description: 'Plan' });
    expect(buildOccurrence(billInput(bill(), providerAccount, undefined, refs), refs, TODAY).response.source_bill).toEqual({ id: 7, description: 'Repair' });
    expect(buildOccurrence(derivedInput(debtSource, nominal, undefined), refs, TODAY).response.source_bill).toBeNull();
    expect(JSON.stringify(buildOccurrence(derivedInput(providerSource, nominal, undefined), refs, TODAY).response)).not.toContain('secret');
  });
});

describe('CalendarService', () => {
  const provSource = (id: number) => billSourceOfProviderBill(
    bill({ id, kind: 'recurring', dueDate: null, description: `Bill ${id}`, chargeFrequency: 'monthly', dueDay: 5, billsFrom: '2026-01-01' }),
    providerAccount,
    null,
  );

  it('keeps two bills of one provider distinct and matches payments per bill; ignores orphans', async () => {
    const query = {
      sources: jest.fn(async () => ({ scheduled: [provSource(21), provSource(22)], providers: new Map([[4, providerAccount]]) })),
      bills: jest.fn(async () => []),
      payments: jest.fn(async () => [
        payment({ id: 1, sourceAccountId: 4, providerBillId: 21, dueDate: '2026-06-05' }),
        payment({ id: 2, sourceAccountId: 4, providerBillId: null, dueDate: '2026-06-05' }),
      ]),
      refs: jest.fn(async () => new Map()),
    };
    const service = new CalendarService(query as never);

    const { occurrences } = await service.calendar(PERSONAL, { from: '2026-06-01', to: '2026-06-30' });

    expect(occurrences.map(({ source_bill: sourceBill, status }) => [sourceBill?.id, status === 'paid'])).toEqual([[21, true], [22, false]]);
    expect(query.payments).toHaveBeenCalledWith([], [21, 22], [], expect.anything());
  });

  it('answers 400 over the 1000 occurrence cap', async () => {
    const query = {
      sources: jest.fn(async () => ({ scheduled: Array.from({ length: 100 }, (_, index) => provSource(index + 1)), providers: new Map([[4, providerAccount]]) })),
      bills: jest.fn(async () => []),
      payments: jest.fn(async () => []),
      refs: jest.fn(async () => new Map()),
    };
    const service = new CalendarService(query as never);

    await expect(service.calendar(PERSONAL, { from: '2026-01-01', to: '2026-12-31' })).rejects.toMatchObject({ status: 400 });
    expect(query.payments).not.toHaveBeenCalled();
  });

  it('cuts overdue to the cap', async () => {
    const query = {
      sources: jest.fn(async () => ({ scheduled: Array.from({ length: 150 }, (_, index) => provSource(index + 1)), providers: new Map() })),
      bills: jest.fn(async () => []),
      payments: jest.fn(async () => []),
      refs: jest.fn(async () => new Map()),
    };
    const service = new CalendarService(query as never);

    const result = await service.overdue(PERSONAL);

    expect(result.occurrences).toHaveLength(1000);
  });

  it('builds the overdue list from past occurrences only', async () => {
    const query = {
      sources: jest.fn(async () => ({ scheduled: [debtSource], providers: new Map() })),
      bills: jest.fn(async () => []),
      payments: jest.fn(async () => [payment({ dueDate: '2026-01-10' })]),
      refs: jest.fn(async () => new Map()),
    };
    const service = new CalendarService(query as never);

    const result = await service.overdue(PERSONAL);

    expect(result.occurrences.length).toBeGreaterThan(0);
    expect(result.occurrences.every(({ status }) => status === 'overdue')).toBe(true);
    expect(result.occurrences.map(({ nominal_date: nominal }) => nominal)).not.toContain('2026-01-10');
  });
});
