import { debtStateOf, defaultDebtState, mergeDebtState } from '../account-types/debt-details.js';
import {
  defaultProviderExpenseState,
  mergeProviderExpenseState,
  providerExpenseStateOf,
} from '../account-types/provider-expense-details.js';
import { applyBillsFromLifecycle, defaultScheduleState, scheduleStateOf } from '../account-types/schedule-fields.js';
import type { DebtDetailsDto } from '../dto/debt-details.dto.js';
import type { ProviderExpenseDetailsDto } from '../dto/provider-expense-details.dto.js';

const TODAY = '2026-11-10';

const debtMerge = (base: ReturnType<typeof defaultDebtState>, fields: Partial<DebtDetailsDto>) =>
  mergeDebtState(base, fields as DebtDetailsDto, 'BRL', TODAY);
const providerMerge = (base: ReturnType<typeof defaultProviderExpenseState>, fields: Partial<ProviderExpenseDetailsDto>) =>
  mergeProviderExpenseState(base, fields as ProviderExpenseDetailsDto, 'BRL', TODAY);

describe('schedule fields', () => {
  describe('defaultScheduleState / scheduleStateOf', () => {
    it('defaults show_in_calendar to true and the rest to null', () => {
      expect(defaultScheduleState()).toEqual({ billsFrom: null, showInCalendar: true, payingAccountId: null });
      expect(defaultDebtState()).toMatchObject(defaultScheduleState());
      expect(defaultProviderExpenseState()).toMatchObject(defaultScheduleState());
    });

    it('keeps only the schedule fields of a row', () => {
      const row = { billsFrom: '2026-01-01', showInCalendar: false, payingAccountId: 3, dueDay: 5 };

      expect(scheduleStateOf(row)).toEqual({ billsFrom: '2026-01-01', showInCalendar: false, payingAccountId: 3 });
      expect(debtStateOf({ ...defaultDebtState(), ...row })).toMatchObject({ billsFrom: '2026-01-01', showInCalendar: false, payingAccountId: 3 });
      expect(providerExpenseStateOf({ ...defaultProviderExpenseState(), ...row })).toMatchObject({ payingAccountId: 3 });
    });
  });

  describe('applyBillsFromLifecycle', () => {
    it('only sets bills_from on a first due_day, when unset and not sent', () => {
      const merged = { dueDay: 5, billsFrom: null };
      applyBillsFromLifecycle({ dueDay: null, billsFrom: null }, merged, {}, TODAY);
      expect(merged.billsFrom).toBe(TODAY);

      const kept = { dueDay: 5, billsFrom: '2025-01-01' };
      applyBillsFromLifecycle({ dueDay: null, billsFrom: '2025-01-01' }, kept, {}, TODAY);
      expect(kept.billsFrom).toBe('2025-01-01');

      const changed = { dueDay: 6, billsFrom: null };
      applyBillsFromLifecycle({ dueDay: 5, billsFrom: null }, changed, {}, TODAY);
      expect(changed.billsFrom).toBeNull();

      const sentNull = { dueDay: 5, billsFrom: null };
      applyBillsFromLifecycle({ dueDay: null, billsFrom: null }, sentNull, { bills_from: null }, TODAY);
      expect(sentNull.billsFrom).toBeNull();
    });
  });

  describe.each([
    ['debt', defaultDebtState, debtMerge],
    ['provider_expense', defaultProviderExpenseState, providerMerge],
  ] as const)('%s merge', (_type, defaults, merge) => {
    const base = defaults();

    it('sets bills_from to today when due_day is first set', () => {
      expect(merge(base, { due_day: 10 })).toMatchObject({ dueDay: 10, billsFrom: TODAY });
    });

    it('keeps bills_from when due_day is cleared', () => {
      const scheduled = { ...base, dueDay: 10, billsFrom: '2026-01-01' };

      expect(merge(scheduled, { due_day: null })).toMatchObject({ dueDay: null, billsFrom: '2026-01-01' });
    });

    it('keeps the stored bills_from when due_day is set again', () => {
      const cleared = { ...base, dueDay: null, billsFrom: '2026-01-01' };

      expect(merge(cleared, { due_day: 3 })).toMatchObject({ dueDay: 3, billsFrom: '2026-01-01' });
    });

    it('lets an explicitly sent bills_from win', () => {
      expect(merge(base, { due_day: 10, bills_from: '2027-02-01' })).toMatchObject({ billsFrom: '2027-02-01' });
      expect(merge(base, { due_day: 10, bills_from: null })).toMatchObject({ billsFrom: null });
    });

    it('copies show_in_calendar and leaves bills_from alone without a due_day', () => {
      expect(merge(base, { show_in_calendar: false })).toMatchObject({ showInCalendar: false, billsFrom: null });
    });
  });
});
