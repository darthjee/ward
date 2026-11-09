import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { ownerSqlWhere, type OwnerContext, type OwnerSqlWhere } from '../core/owner-context.js';
import { Transaction } from './entities/transaction.entity.js';

/** Most charges one preview returns; one more row is read to detect an overflow. */
export const PREVIEW_MAX_ROWS = 1000;

/** One preview row: a charge and its provider account, amounts in minor units. */
export interface AccountantChargeRow {
  id: number;
  date: string;
  description: string;
  amount: bigint;
  sentToAccountantAt: Date | null;
  accountId: number;
  accountName: string;
  bankName: string | null;
  providerTaxId: string | null;
  currency: string;
}

/** A posted transaction resolved (and locked) by the mark routes. */
export interface ResolvedMarkRow {
  id: number;
  amount: bigint;
  sentToAccountantAt: Date | null;
  type: string;
  /** `null` when the account has no provider details (another account type). */
  forAccountant: boolean | null;
}

interface RawChargeRow {
  id: number | string;
  date: string;
  description: string;
  amount: string | number;
  sent_to_accountant_at: Date | string | null;
  account_id: number | string;
  account_name: string;
  bank_name: string | null;
  provider_tax_id: string | null;
  currency: string;
}

interface RawResolvedRow {
  id: number | string;
  amount: string | number;
  sent_to_accountant_at: Date | string | null;
  type: string;
  for_accountant: number | string | boolean | null;
}

function placeholders(ids: number[]): string {
  return ids.map(() => '?').join(', ');
}

function toDate(value: Date | string | null): Date | null {
  return value === null ? null : new Date(value);
}

// Charges (negative amounts) of the owner's `for_accountant` provider accounts, archived
// included, in the range; walks the owner's accounts, then their charges through the
// `(account_id, date, id)` index. `DATE_FORMAT` keeps the `DATE` a plain string.
function previewSql(owner: OwnerSqlWhere, includeSent: boolean): string {
  return `SELECT t.id, DATE_FORMAT(t.date, '%Y-%m-%d') AS date, t.description, t.amount, t.sent_to_accountant_at,
         a.id AS account_id, a.name AS account_name, a.bank_name, d.provider_tax_id, a.currency
    FROM bank_accounts a
    JOIN bank_provider_expense_details d ON d.account_id = a.id
    JOIN bank_transactions t ON t.account_id = a.id
   WHERE ${owner.sql}
     AND a.type = 'provider_expense'
     AND d.for_accountant = 1
     AND t.amount < 0
     AND t.date BETWEEN ? AND ?${includeSent ? '' : '\n     AND t.sent_to_accountant_at IS NULL'}
   ORDER BY t.date, t.id
   LIMIT ${PREVIEW_MAX_ROWS + 1}`;
}

/**
 * The accountant hand-off's raw SQL, kept in its own fakeable class (like
 * `LedgerQuery`): unit specs fake it, the MySQL integration spec covers the
 * real SQL. Every query is scoped to the active owner through `bank_accounts`
 * (transactions and details carry no owner). Amounts never go through a float.
 */
@Injectable()
export class AccountantChargesQuery {
  private readonly transactionRepository: Repository<Transaction>;

  /**
   * @param {Repository<Transaction>} transactionRepository - The transaction repository.
   */
  constructor(@InjectRepository(Transaction) transactionRepository: Repository<Transaction>) {
    this.transactionRepository = transactionRepository;
  }

  /**
   * Reads the preview: at most {@link PREVIEW_MAX_ROWS} + 1 rows, ordered by
   * date then id, so the caller can tell an overflow apart.
   * @param {OwnerContext} owner - The active owner.
   * @param {string} from - The first day (`YYYY-MM-DD`, inclusive).
   * @param {string} to - The last day (`YYYY-MM-DD`, inclusive).
   * @param {boolean} includeSent - Whether sent charges are listed too.
   * @returns {Promise<AccountantChargeRow[]>} The charges.
   */
  async preview(owner: OwnerContext, from: string, to: string, includeSent: boolean): Promise<AccountantChargeRow[]> {
    const ownerFilter = ownerSqlWhere(owner, 'a');
    const rows: RawChargeRow[] = await this.transactionRepository.query(previewSql(ownerFilter, includeSent), [
      ...ownerFilter.params,
      from,
      to,
    ]);

    return rows.map((row) => ({
      id: Number(row.id),
      date: row.date,
      description: row.description,
      amount: BigInt(row.amount),
      sentToAccountantAt: toDate(row.sent_to_accountant_at),
      accountId: Number(row.account_id),
      accountName: row.account_name,
      bankName: row.bank_name,
      providerTaxId: row.provider_tax_id,
      currency: row.currency,
    }));
  }

  /**
   * Resolves the posted ids in **one** owner-scoped query and locks their
   * `bank_transactions` rows (`FOR UPDATE OF t`: not the accounts or details)
   * until the surrounding DB transaction ends. Ids of another owner or context
   * are simply absent from the result.
   * @param {EntityManager} manager - The manager of the running DB transaction.
   * @param {OwnerContext} owner - The active owner.
   * @param {number[]} ids - The de-duplicated transaction ids.
   * @returns {Promise<ResolvedMarkRow[]>} The owner's matching transactions.
   */
  async resolveForUpdate(manager: EntityManager, owner: OwnerContext, ids: number[]): Promise<ResolvedMarkRow[]> {
    const ownerFilter = ownerSqlWhere(owner, 'a');
    const rows: RawResolvedRow[] = await manager.query(
      `SELECT t.id, t.amount, t.sent_to_accountant_at, a.type, d.for_accountant
         FROM bank_transactions t
         JOIN bank_accounts a ON a.id = t.account_id
         LEFT JOIN bank_provider_expense_details d ON d.account_id = a.id
        WHERE t.id IN (${placeholders(ids)}) AND ${ownerFilter.sql}
          FOR UPDATE OF t`,
      [...ids, ...ownerFilter.params],
    );

    return rows.map((row) => ({
      id: Number(row.id),
      amount: BigInt(row.amount),
      sentToAccountantAt: toDate(row.sent_to_accountant_at),
      type: row.type,
      forAccountant: row.for_accountant === null ? null : Boolean(Number(row.for_accountant)),
    }));
  }

  /**
   * Stamps the unsent ones among `ids`; already-sent ones keep their original timestamp.
   *
   * **Warning:** this UPDATE filters by id only, with no owner scope. Callers must
   * first resolve and lock `ids` under the owner via {@link resolveForUpdate} in
   * the same DB transaction, and pass only the ids it returned.
   * @param {EntityManager} manager - The manager of the running DB transaction.
   * @param {number[]} ids - The (already resolved and checked) transaction ids.
   * @param {Date} now - The timestamp to stamp.
   * @returns {Promise<void>}
   */
  async stamp(manager: EntityManager, ids: number[], now: Date): Promise<void> {
    await manager.query(
      `UPDATE bank_transactions SET sent_to_accountant_at = ?
        WHERE id IN (${placeholders(ids)}) AND sent_to_accountant_at IS NULL`,
      [now, ...ids],
    );
  }

  /**
   * Clears the mark of `ids` (already-unsent ones are a no-op).
   *
   * **Warning:** this UPDATE filters by id only, with no owner scope. Callers must
   * first resolve and lock `ids` under the owner via {@link resolveForUpdate} in
   * the same DB transaction, and pass only the ids it returned.
   * @param {EntityManager} manager - The manager of the running DB transaction.
   * @param {number[]} ids - The (already resolved and checked) transaction ids.
   * @returns {Promise<void>}
   */
  async clear(manager: EntityManager, ids: number[]): Promise<void> {
    await manager.query(
      `UPDATE bank_transactions SET sent_to_accountant_at = NULL WHERE id IN (${placeholders(ids)})`,
      ids,
    );
  }
}
