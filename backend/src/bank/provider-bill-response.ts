import { formatAmount } from './currency.js';
import type { ProviderBill, ProviderBillKind } from './entities/provider-bill.entity.js';
import type { Pagination } from './pagination.js';

/** A provider bill as returned by `provider-bills` (explicit mapping, never an entity spread). */
export interface ProviderBillResponse {
  id: number;
  provider_account_id: number;
  kind: ProviderBillKind;
  description: string;
  paying_account_id: number | null;
  expected_amount: string | null;
  notes: string | null;
  charge_frequency: string | null;
  due_day: number | null;
  due_month: number | null;
  bills_from: string | null;
  show_in_calendar: boolean | null;
  due_date: string | null;
  created_at: Date;
  updated_at: Date;
}

/** `GET <base>/accounts/:accountId/provider-bills.json`. */
export interface ProviderBillListResponse {
  provider_bills: ProviderBillResponse[];
  pagination: Pagination;
}

/**
 * @param {ProviderBill} bill - The stored bill.
 * @param {string} currency - The provider's currency (formats `expected_amount`).
 * @returns {ProviderBillResponse} The response object.
 */
export function serializeProviderBill(bill: ProviderBill, currency: string): ProviderBillResponse {
  return {
    id: bill.id,
    provider_account_id: bill.providerAccountId,
    kind: bill.kind,
    description: bill.description,
    paying_account_id: bill.payingAccountId,
    expected_amount: bill.expectedAmount === null ? null : formatAmount(bill.expectedAmount, currency),
    notes: bill.notes,
    charge_frequency: bill.chargeFrequency,
    due_day: bill.dueDay,
    due_month: bill.dueMonth,
    bills_from: bill.billsFrom,
    show_in_calendar: bill.showInCalendar,
    due_date: bill.dueDate,
    created_at: bill.createdAt,
    updated_at: bill.updatedAt,
  };
}
