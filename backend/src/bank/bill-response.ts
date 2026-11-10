import type { AccountRef } from './account-refs.js';
import { formatAmount } from './currency.js';
import type { Account } from './entities/account.entity.js';
import type { BillPayment } from './entities/bill-payment.entity.js';
import type { Bill } from './entities/bill.entity.js';
import { serializePayment, type PaymentResponse } from './occurrence-response.js';
import type { Pagination } from './pagination.js';

/** The public view of a one-off bill (snake_case; never an owner field). */
export interface BillResponse {
  id: number;
  provider_account: AccountRef;
  paying_account: AccountRef | null;
  due_date: string;
  amount: string;
  currency: string;
  description: string;
  notes: string | null;
  payment: PaymentResponse | null;
  created_at: Date;
  updated_at: Date;
}

/** The envelope of `GET <base>/bills.json`. */
export interface BillListResponse {
  bills: BillResponse[];
  pagination: Pagination;
}

/**
 * @param {Bill} bill - The bill.
 * @param {Account} provider - Its provider-expense account (its currency and name).
 * @param {BillPayment | undefined} payment - Its payment row, if any.
 * @param {Map<number, AccountRef>} refs - Account refs (paying accounts).
 * @returns {BillResponse} Its public view; the amounts in the provider's currency.
 */
export function serializeBill(
  bill: Bill,
  provider: Account,
  payment: BillPayment | undefined,
  refs: Map<number, AccountRef>,
): BillResponse {
  return {
    id: bill.id,
    provider_account: { id: provider.id, name: provider.name },
    paying_account: bill.payingAccountId === null ? null : refs.get(bill.payingAccountId) ?? null,
    due_date: bill.dueDate,
    amount: formatAmount(bill.amount, provider.currency),
    currency: provider.currency,
    description: bill.description,
    notes: bill.notes,
    payment: payment ? serializePayment(payment, provider.currency, refs) : null,
    created_at: bill.createdAt,
    updated_at: bill.updatedAt,
  };
}
