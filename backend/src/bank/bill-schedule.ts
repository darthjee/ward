import type { AccountRef } from './account-refs.js';
import type { WithPayingAccount } from './account-types/schedule-fields.js';
import type { Account } from './entities/account.entity.js';
import type { DebtDetails } from './entities/debt-details.entity.js';
import type { ProviderBill } from './entities/provider-bill.entity.js';
import type { BillSchedule } from './occurrence-generator.js';
import { providerBillSchedule } from './provider-bill.schedule.js';

/** The account types that are recurring bill sources. */
export const DEBT_TYPE = 'debt';
export const PROVIDER_TYPE = 'provider_expense';
export const BILL_SOURCE_TYPES = [DEBT_TYPE, PROVIDER_TYPE];

/** The `kind` of an occurrence. */
export type OccurrenceKind = 'debt' | 'provider' | 'bill';

/** A debt account, or one recurring provider bill, with what the occurrences need. */
export interface BillSource {
  account: Account;
  kind: 'debt' | 'provider';
  schedule: BillSchedule;
  /** The debt's `instalmentAmount` / the bill's `expectedAmount`, minor units; `null` when unset. */
  expected: bigint | null;
  defaultPayingAccount: AccountRef | null;
  /** The recurring provider bill this source stands for; `null` for debts. */
  bill: ProviderBill | null;
}

type SourceDetails = (Partial<DebtDetails> & WithPayingAccount) | undefined;

/**
 * @param {Account} account - A debt account (providers are sourced per recurring bill,
 *   see {@link billSourceOfProviderBill}).
 * @param {unknown} details - Its loaded details row (with `payingAccount`), if any.
 * @returns {BillSource} The account's schedule, instalment amount and default paying account.
 */
export function billSourceOf(account: Account, details: unknown): BillSource {
  const row = details as SourceDetails;

  return {
    account,
    kind: 'debt',
    schedule: {
      frequency: row?.instalmentFrequency ?? 'monthly',
      dueDay: row?.dueDay ?? null,
      dueMonth: row?.dueMonth ?? null,
      billsFrom: row?.billsFrom ?? null,
      showInCalendar: row?.showInCalendar ?? true,
      archived: account.archivedAt !== null,
    },
    expected: row?.instalmentAmount ?? null,
    defaultPayingAccount: row?.payingAccount ?? null,
    bill: null,
  };
}

/**
 * @param {ProviderBill} bill - A recurring provider bill.
 * @param {Account} provider - Its provider-expense account.
 * @param {AccountRef | null} defaultPayingRef - The bill's paying account ref, if any.
 * @returns {BillSource} The bill's source: its own schedule, expected amount and paying account.
 */
export function billSourceOfProviderBill(bill: ProviderBill, provider: Account, defaultPayingRef: AccountRef | null): BillSource {
  const schedule = providerBillSchedule(bill, provider);

  if (schedule === null) {
    throw new Error('A one-off provider bill has no schedule');
  }

  return { account: provider, kind: 'provider', schedule, expected: bill.expectedAmount, defaultPayingAccount: defaultPayingRef, bill };
}
