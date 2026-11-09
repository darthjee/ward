import { formatAmount } from './currency.js';
import type { Account } from './entities/account.entity.js';
import type { Transaction } from './entities/transaction.entity.js';
import type { LedgerRow } from './ledger.query.js';
import type { Pagination } from './pagination.js';

/** The account type whose charges carry the accountant hand-off mark. */
export const PROVIDER_EXPENSE_TYPE = 'provider_expense';

/**
 * The hand-off mark, present only on a charge of a provider-expense account: the ISO timestamp,
 * or `null` when unsent. Absent everywhere else, so other responses stay unchanged.
 */
export interface HandOffMark {
  sent_to_accountant_at?: Date | null;
}

/** The public view of a transaction (snake_case; never an owner field). */
export interface TransactionResponse extends HandOffMark {
  id: number;
  date: string;
  amount: string;
  description: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

/** One ledger row of the ledger envelope. */
export interface LedgerRowResponse extends HandOffMark {
  id: number;
  date: string;
  amount: string;
  description: string;
  notes: string | null;
  balance: string;
}

/** The virtual opening row: its `balance` equals its `amount`. */
export interface LedgerOpeningResponse {
  date: string;
  amount: string;
  balance: string;
}

/** The ledger envelope of `GET <base>/accounts/:accountId/transactions.json`. */
export interface LedgerResponse {
  transactions: LedgerRowResponse[];
  opening: LedgerOpeningResponse | null;
  pagination: Pagination;
}

/**
 * @param {Account} account - The transaction's account (its type and currency).
 * @param {bigint} amount - The signed amount, in minor units.
 * @param {Date | null | undefined} sentAt - The stored hand-off mark.
 * @returns {HandOffMark} `{ sent_to_accountant_at }` for a charge of a provider-expense
 *   account, `{}` otherwise (the key is absent, not `null`).
 */
export function handOffMark(account: Account, amount: bigint, sentAt: Date | null | undefined): HandOffMark {
  if (account.type !== PROVIDER_EXPENSE_TYPE || amount >= 0n) {
    return {};
  }

  return { sent_to_accountant_at: sentAt ?? null };
}

/**
 * @param {Transaction} transaction - The transaction.
 * @param {Account} account - Its account (for the currency and the hand-off mark).
 * @returns {TransactionResponse} Its public view, `amount` as a decimal string.
 */
export function serializeTransaction(transaction: Transaction, account: Account): TransactionResponse {
  return {
    id: transaction.id,
    date: transaction.date,
    amount: formatAmount(transaction.amount, account.currency),
    description: transaction.description,
    notes: transaction.notes,
    ...handOffMark(account, transaction.amount, transaction.sentToAccountantAt),
    created_at: transaction.createdAt,
    updated_at: transaction.updatedAt,
  };
}

/**
 * Builds the ledger envelope.
 * @param {Account} account - The account (for its currency and opening date).
 * @param {LedgerRow[]} rows - The page's rows.
 * @param {bigint | null} opening - The effective opening amount on the last
 *   page, `null` on every other page.
 * @param {Pagination} pagination - The pagination metadata.
 * @returns {LedgerResponse} `{ transactions, opening, pagination }`, amounts and
 *   balances as decimal strings in the account's currency.
 */
export function serializeLedger(
  account: Account,
  rows: LedgerRow[],
  opening: bigint | null,
  pagination: Pagination,
): LedgerResponse {
  const format = (minor: bigint): string => formatAmount(minor, account.currency);

  return {
    transactions: rows.map((row) => ({
      id: row.id,
      date: row.date,
      amount: format(row.amount),
      description: row.description,
      notes: row.notes,
      ...handOffMark(account, row.amount, row.sentToAccountantAt),
      balance: format(row.balance),
    })),
    opening: opening === null ? null : { date: account.openingDate, amount: format(opening), balance: format(opening) },
    pagination,
  };
}
