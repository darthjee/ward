import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OwnerScope } from '../core/owner-context.js';
import type { Account } from './entities/account.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { paymentGeneratedExistsSql } from './payment-generated.query.js';

/**
 * One ledger row with its running balance, in minor units.
 */
export interface LedgerRow {
  id: number;
  date: string;
  amount: bigint;
  description: string;
  notes: string | null;
  /** The hand-off mark; the serializer decides whether it is shown. */
  sentToAccountantAt: Date | null;
  /** Whether one of the owner's bill payments references the transaction. */
  paymentGenerated: boolean;
  balance: bigint;
}

interface RawLedgerRow {
  id: number | string;
  date: string;
  amount: string | number;
  description: string;
  notes: string | null;
  sent_to_accountant_at: Date | string | null;
  payment_generated: number | string;
  cumulative: string | number;
  before_anchor: string | number;
}

// The running balance is a window function over the account's whole ledger,
// computed before the LIMIT (so it is right on every page); the newest-first
// order and the page window are applied outside. `before_anchor` is the sum of
// the transactions dated before the opening anchor (same on every row).
// `payment_generated` is a correlated, owner-scoped `EXISTS` per row (no extra
// query per row); its owner placeholders come first in the params.
// `DATE_FORMAT` keeps the `DATE` a plain string, never a timezone-shifted `Date`.
function ledgerPageSql(paymentGeneratedSql: string): string {
  return `SELECT id, date, amount, description, notes, sent_to_accountant_at, payment_generated, cumulative, before_anchor
  FROM (
    SELECT t.id, DATE_FORMAT(t.date, '%Y-%m-%d') AS date, t.date AS sort_date, t.amount, t.description, t.notes,
           t.sent_to_accountant_at,
           ${paymentGeneratedSql} AS payment_generated,
           SUM(t.amount) OVER (ORDER BY t.date, t.id ROWS UNBOUNDED PRECEDING) AS cumulative,
           SUM(IF(t.date < ?, t.amount, 0)) OVER () AS before_anchor
      FROM bank_transactions t
     WHERE t.account_id = ?
  ) ledger
 ORDER BY sort_date DESC, id DESC
 LIMIT ? OFFSET ?`;
}

const BEFORE_ANCHOR_SQL = `SELECT COALESCE(SUM(amount), 0) AS total
  FROM bank_transactions WHERE account_id = ? AND date < ?`;

const COUNT_SQL = 'SELECT COUNT(*) AS total FROM bank_transactions WHERE account_id = ?';

/**
 * The ledger's raw SQL (window functions), kept in its own fakeable class:
 * unit specs fake it, the MySQL integration spec covers the real SQL. Callers
 * have already scoped the account to its owner. Amounts never go through a
 * float: mysql2 returns `BIGINT` / `DECIMAL` as strings, turned into `bigint`.
 *
 * - opening (effective) = `opening_balance` − SUM(transactions before `opening_date`);
 * - running balance of a row = opening (effective) + SUM(amount) up to the row
 *   (ordered by `date, id`);
 * - so a transaction dated on `opening_date` counts after the anchor.
 */
@Injectable()
export class LedgerQuery {
  private readonly transactionRepository: Repository<Transaction>;

  /**
   * @param {Repository<Transaction>} transactionRepository - The transaction repository.
   */
  constructor(@InjectRepository(Transaction) transactionRepository: Repository<Transaction>) {
    this.transactionRepository = transactionRepository;
  }

  /**
   * @param {number} accountId - The account id.
   * @returns {Promise<number>} The number of transactions of the account.
   */
  async count(accountId: number): Promise<number> {
    const [row]: Array<{ total: string | number }> = await this.transactionRepository.query(COUNT_SQL, [accountId]);

    return Number(row.total);
  }

  /**
   * Reads one page of the ledger, newest first (within a day, newest id
   * first), each row with its running balance and its payment-generated flag.
   * @param {OwnerScope} owner - The data owner scope (for the payment-generated flag).
   * @param {Account} account - The account.
   * @param {number} page - The 1-based page.
   * @param {number} perPage - Rows per page.
   * @returns {Promise<LedgerRow[]>} The page's rows (empty past the last page).
   */
  async page(owner: OwnerScope, account: Account, page: number, perPage: number): Promise<LedgerRow[]> {
    const paymentGenerated = paymentGeneratedExistsSql(owner, 't.id');
    const rows: RawLedgerRow[] = await this.transactionRepository.query(ledgerPageSql(paymentGenerated.sql), [
      ...paymentGenerated.params,
      account.openingDate,
      account.id,
      perPage,
      (page - 1) * perPage,
    ]);

    return rows.map((row) => ({
      id: Number(row.id),
      date: row.date,
      amount: BigInt(row.amount),
      description: row.description,
      notes: row.notes,
      sentToAccountantAt: row.sent_to_accountant_at === null ? null : new Date(row.sent_to_accountant_at),
      paymentGenerated: Number(row.payment_generated) === 1,
      balance: account.openingBalance - BigInt(row.before_anchor) + BigInt(row.cumulative),
    }));
  }

  /**
   * @param {Account} account - The account.
   * @returns {Promise<bigint>} The virtual opening row's amount (and balance):
   *   `opening_balance` − SUM(transactions dated before `opening_date`).
   */
  async openingEffective(account: Account): Promise<bigint> {
    const [row]: Array<{ total: string | number }> = await this.transactionRepository.query(BEFORE_ANCHOR_SQL, [
      account.id,
      account.openingDate,
    ]);

    return account.openingBalance - BigInt(row.total);
  }
}
