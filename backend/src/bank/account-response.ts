import { formatAmount } from './currency.js';
import type { Account } from './entities/account.entity.js';

const MASK_PREFIX = '•••• ';
const MASK_VISIBLE_CHARACTERS = 4;

/**
 * The public view of an account (snake_case). Never carries the owner fields
 * (`user_id`, `organization_id`). A type with details adds its nested object
 * under its own type name (e.g. `debt`).
 */
export interface AccountResponse {
  id: number;
  type: string;
  name: string;
  bank_name: string | null;
  branch: string | null;
  account_number: string | null;
  currency: string;
  opening_date: string;
  opening_balance: string;
  balance: string;
  archived_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  [nested: string]: unknown;
}

/**
 * Options of {@link serializeAccount}.
 */
export interface SerializeAccountOptions {
  /** The current balance, in minor units. */
  balance: bigint;
  /** Mask `account_number` (lists); the detail returns it in full. */
  mask: boolean;
  /** The handler's nested response object, if any. */
  nested?: Record<string, unknown>;
}

/**
 * Masks an account number, keeping only its last characters (`•••• 1234`).
 * @param {string | null} accountNumber - The stored account number.
 * @returns {string | null} The masked number, or `null` when there is none.
 */
export function maskAccountNumber(accountNumber: string | null): string | null {
  if (accountNumber === null) {
    return null;
  }

  return `${MASK_PREFIX}${[...accountNumber].slice(-MASK_VISIBLE_CHARACTERS).join('')}`;
}

/**
 * Serializes an {@link Account} into its public view (entities are never
 * returned directly). Amounts are decimal strings in the currency's exponent.
 * @param {Account} account - The account.
 * @param {SerializeAccountOptions} options - Balance, masking and nested object.
 * @returns {AccountResponse} The public view, without any owner field.
 */
export function serializeAccount(account: Account, options: SerializeAccountOptions): AccountResponse {
  const response: AccountResponse = {
    id: account.id,
    type: account.type,
    name: account.name,
    bank_name: account.bankName,
    branch: account.branch,
    account_number: options.mask ? maskAccountNumber(account.accountNumber) : account.accountNumber,
    currency: account.currency,
    opening_date: account.openingDate,
    opening_balance: formatAmount(account.openingBalance, account.currency),
    balance: formatAmount(options.balance, account.currency),
    archived_at: account.archivedAt,
    notes: account.notes,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };

  if (options.nested !== undefined) {
    response[account.type] = options.nested;
  }

  return response;
}
