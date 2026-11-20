import { billSourceOfProviderBill } from '../bill-schedule.js';
import type { Account } from '../entities/account.entity.js';
import type { ProviderBill } from '../entities/provider-bill.entity.js';
import { isProviderBillOccurrence, providerBillSchedule } from '../provider-bill.schedule.js';

const provider = (archivedAt: Date | null = null): Account => ({ id: 1, archivedAt } as Account);

const bill = (overrides: Partial<ProviderBill> = {}): ProviderBill => ({
  id: 5,
  kind: 'recurring',
  chargeFrequency: 'monthly',
  dueDay: 10,
  dueMonth: null,
  billsFrom: '2026-01-01',
  showInCalendar: true,
  dueDate: null,
  expectedAmount: 1000n,
  ...overrides,
} as ProviderBill);

describe('provider bill schedule', () => {
  it('is null for one-offs', () => {
    expect(providerBillSchedule(bill({ kind: 'one_off', dueDate: '2026-05-05' }), provider())).toBeNull();
  });

  it('defaults frequency and visibility', () => {
    const schedule = providerBillSchedule(bill({ chargeFrequency: null, showInCalendar: null }), provider());

    expect(schedule).toMatchObject({ frequency: 'monthly', showInCalendar: true, archived: false });
  });

  it('recognises monthly occurrences', () => {
    expect(isProviderBillOccurrence(bill(), provider(), '2026-03-10')).toBe(true);
    expect(isProviderBillOccurrence(bill(), provider(), '2026-03-11')).toBe(false);
    expect(isProviderBillOccurrence(bill(), provider(), '2025-12-10')).toBe(false);
  });

  it('recognises yearly occurrences', () => {
    const yearly = bill({ chargeFrequency: 'yearly', dueMonth: 3 });

    expect(isProviderBillOccurrence(yearly, provider(), '2026-03-10')).toBe(true);
    expect(isProviderBillOccurrence(yearly, provider(), '2026-04-10')).toBe(false);
  });

  it('rejects hidden bills, archived providers and a null due_day', () => {
    expect(isProviderBillOccurrence(bill({ showInCalendar: false }), provider(), '2026-03-10')).toBe(false);
    expect(isProviderBillOccurrence(bill(), provider(new Date()), '2026-03-10')).toBe(false);
    expect(isProviderBillOccurrence(bill({ dueDay: null }), provider(), '2026-03-10')).toBe(false);
  });

  it('checks one-off equality and impossible dates', () => {
    const oneOff = bill({ kind: 'one_off', dueDate: '2026-05-05' });

    expect(isProviderBillOccurrence(oneOff, provider(), '2026-05-05')).toBe(true);
    expect(isProviderBillOccurrence(oneOff, provider(), '2026-05-06')).toBe(false);
    expect(isProviderBillOccurrence(bill(), provider(), '2026-02-31')).toBe(false);
    expect(isProviderBillOccurrence(bill(), provider(), 'nope')).toBe(false);
  });

  it('builds a provider source from a bill', () => {
    const source = billSourceOfProviderBill(bill(), provider(), { id: 2, name: 'Main' });

    expect(source).toMatchObject({ kind: 'provider_bill', expected: 1000n, defaultPayingAccount: { id: 2 } });
    expect(source.bill?.id).toBe(5);
    expect(() => billSourceOfProviderBill(bill({ kind: 'one_off' }), provider(), null)).toThrow();
  });
});
