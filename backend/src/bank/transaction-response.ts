import { formatAmount } from './currency.js';
import type { Account } from './entities/account.entity.js';
import type { Transaction } from './entities/transaction.entity.js';
import type { LedgerRow } from './ledger.query.js';
import type { Pagination } from './pagination.js';

/** The public view of a transaction (snake_case; never an owner field). */
export interface TransactionResponse {
  id: number;
  date: string;
  amount: string;
  description: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

/** One ledger row of the ledger envelope. */
export interface LedgerRowResponse {
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
 * @param {Transaction} transaction - The transaction.
 * @param {string} currency - The account's ISO 4217 code.
 * @returns {TransactionResponse} Its public view, `amount` as a decimal string.
 */
export function serializeTransaction(transaction: Transaction, currency: string): TransactionResponse {
  return {
    id: transaction.id,
    date: transaction.date,
    amount: formatAmount(transaction.amount, currency),
    description: transaction.description,
    notes: transaction.notes,
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
      balance: format(row.balance),
    })),
    opening: opening === null ? null : { date: account.openingDate, amount: format(opening), balance: format(opening) },
    pagination,
  };
}
