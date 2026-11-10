import type { AccountRef } from './account-refs.js';
import type { WithPayingAccount } from './account-types/schedule-fields.js';
import type { Account } from './entities/account.entity.js';
import type { DebtDetails } from './entities/debt-details.entity.js';
import type { ProviderExpenseDetails } from './entities/provider-expense-details.entity.js';
import type { BillSchedule } from './occurrence-generator.js';

/** The account types that are recurring bill sources. */
export const DEBT_TYPE = 'debt';
export const PROVIDER_TYPE = 'provider_expense';
export const BILL_SOURCE_TYPES = [DEBT_TYPE, PROVIDER_TYPE];

/** The `kind` of an occurrence. */
export type OccurrenceKind = 'debt' | 'provider' | 'bill';

/** A debt / provider-expense account with what the occurrences need from its details. */
export interface BillSource {
  account: Account;
  kind: 'debt' | 'provider';
  schedule: BillSchedule;
  /** `instalmentAmount` / `expectedAmount`, minor units; `null` when unset. */
  expected: bigint | null;
  defaultPayingAccount: AccountRef | null;
}

type SourceDetails = (Partial<DebtDetails> & Partial<ProviderExpenseDetails> & WithPayingAccount) | undefined;

/**
 * @param {boolean} debt - Whether the account is a debt (else a provider).
 * @param {SourceDetails} row - The loaded details row, if any.
 * @returns {object} The type-specific frequency and expected amount.
 */
function typeFields(debt: boolean, row: SourceDetails): { frequency: BillSchedule['frequency']; expected: bigint | null } {
  const frequency = debt ? row?.instalmentFrequency : row?.chargeFrequency;
  const expected = debt ? row?.instalmentAmount : row?.expectedAmount;

  return { frequency: frequency ?? 'monthly', expected: expected ?? null };
}

/**
 * @param {Account} account - A debt or provider-expense account.
 * @param {unknown} details - Its loaded details row (with `payingAccount`), if any.
 * @returns {BillSource} The account's schedule, expected amount and default paying account.
 */
export function billSourceOf(account: Account, details: unknown): BillSource {
  const row = details as SourceDetails;
  const debt = account.type === DEBT_TYPE;
  const { frequency, expected } = typeFields(debt, row);

  return {
    account,
    kind: debt ? 'debt' : 'provider',
    schedule: {
      frequency,
      dueDay: row?.dueDay ?? null,
      dueMonth: row?.dueMonth ?? null,
      billsFrom: row?.billsFrom ?? null,
      showInCalendar: row?.showInCalendar ?? true,
      archived: account.archivedAt !== null,
    },
    expected,
    defaultPayingAccount: row?.payingAccount ?? null,
  };
}
