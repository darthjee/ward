import type { Account } from './entities/account.entity.js';
import type { ProviderBill } from './entities/provider-bill.entity.js';
import { isNominalOccurrence, type BillSchedule } from './occurrence-generator.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {ProviderBill} bill - A provider bill.
 * @param {Account} provider - Its provider-expense account.
 * @returns {BillSchedule | null} The bill's schedule, or `null` for a one-off bill.
 */
export function providerBillSchedule(bill: ProviderBill, provider: Account): BillSchedule | null {
  if (bill.kind !== 'recurring') {
    return null;
  }

  return {
    frequency: bill.chargeFrequency === 'yearly' ? 'yearly' : 'monthly',
    dueDay: bill.dueDay,
    dueMonth: bill.dueMonth,
    billsFrom: bill.billsFrom,
    showInCalendar: bill.showInCalendar ?? true,
    archived: provider.archivedAt !== null,
  };
}

/**
 * @param {ProviderBill} bill - A provider bill.
 * @param {Account} provider - Its provider-expense account.
 * @param {string} date - A candidate nominal due date.
 * @returns {boolean} Whether `date` is an occurrence of the bill.
 */
export function isProviderBillOccurrence(bill: ProviderBill, provider: Account, date: string): boolean {
  if (!DATE_PATTERN.test(date)) {
    return false;
  }

  const schedule = providerBillSchedule(bill, provider);

  return schedule === null ? bill.dueDate === date : isNominalOccurrence(schedule, date);
}
