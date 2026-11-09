import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import {
  AccountantChargesQuery,
  PREVIEW_MAX_ROWS,
  type AccountantChargeRow,
  type ResolvedMarkRow,
} from './accountant-charges.query.js';
import { formatAmount } from './currency.js';
import {
  assertHandOffRange,
  handOffValidationFailed,
  type AccountantChargesQueryDto,
} from './dto/accountant-charges-query.dto.js';
import type { MarkChargesDto } from './dto/mark-charges.dto.js';
import { Transaction } from './entities/transaction.entity.js';
import { PROVIDER_EXPENSE_TYPE } from './transaction-response.js';

/** One preview row: the charge's own fields, its provider under `account`. */
export interface AccountantChargeResponse {
  id: number;
  date: string;
  description: string;
  amount: string;
  sent_to_accountant_at: Date | null;
  account: {
    id: number;
    name: string;
    bank_name: string | null;
    provider_tax_id: string | null;
    currency: string;
  };
}

/** The preview envelope of `GET <base>/accountant/charges.json`. */
export interface AccountantChargesResponse {
  charges: AccountantChargeResponse[];
}

/** The reply of the mark routes: every posted id (de-duplicated) and its resulting mark. */
export interface MarkChargesResponse {
  charges: Array<{ id: number; sent_to_accountant_at: Date | null }>;
}

type MarkMode = 'sent' | 'unsent';

/**
 * The accountant hand-off (lazy `BankModule`): the preview of the active
 * owner's business charges, and Mark as sent / unsent. The mark routes are
 * all-or-nothing: the posted ids are resolved and locked in one owner-scoped
 * query inside a DB transaction, any unresolved id answers the uniform 404
 * (checked first), any id that is not a hand-off charge answers 400, and only
 * then one `UPDATE` runs. Archived accounts are allowed (hand-off metadata,
 * not a ledger edit).
 */
@Injectable()
export class AccountantService {
  private readonly transactionRepository: Repository<Transaction>;
  private readonly chargesQuery: AccountantChargesQuery;

  /**
   * @param {Repository<Transaction>} transactionRepository - The transaction repository (for its manager).
   * @param {AccountantChargesQuery} chargesQuery - The hand-off SQL.
   */
  constructor(
    @InjectRepository(Transaction) transactionRepository: Repository<Transaction>,
      chargesQuery: AccountantChargesQuery,
  ) {
    this.transactionRepository = transactionRepository;
    this.chargesQuery = chargesQuery;
  }

  /**
   * @param {OwnerContext} owner - The active owner.
   * @param {AccountantChargesQueryDto} query - The validated query.
   * @returns {Promise<AccountantChargesResponse>} The charges, ordered by date then id.
   * @throws {BadRequestException} 400 for an invalid range or more than 1000 charges.
   */
  async preview(owner: OwnerContext, query: AccountantChargesQueryDto): Promise<AccountantChargesResponse> {
    assertHandOffRange(query.from, query.to);
    const rows = await this.chargesQuery.preview(owner, query.from, query.to, query.include_sent === 'true');

    if (rows.length > PREVIEW_MAX_ROWS) {
      throw handOffValidationFailed(`more than ${PREVIEW_MAX_ROWS} charges in the range; narrow the range`);
    }

    return { charges: rows.map(serializeCharge) };
  }

  /**
   * Stamps the posted charges; an already-sent charge keeps its original timestamp.
   * @param {OwnerContext} owner - The active owner.
   * @param {MarkChargesDto} dto - The validated body.
   * @returns {Promise<MarkChargesResponse>} Every posted id with its resulting mark.
   * @throws {NotFoundException} The uniform 404 when any id is not the owner's.
   * @throws {BadRequestException} 400 when any id is a payment, an unflagged or a non-provider charge.
   */
  async markSent(owner: OwnerContext, dto: MarkChargesDto): Promise<MarkChargesResponse> {
    return this.#mark(owner, dto, 'sent');
  }

  /**
   * Clears the mark of the posted charges (an unsent one is a no-op).
   * @param {OwnerContext} owner - The active owner.
   * @param {MarkChargesDto} dto - The validated body.
   * @returns {Promise<MarkChargesResponse>} Every posted id with a `null` mark.
   * @throws {NotFoundException} The uniform 404 when any id is not the owner's.
   * @throws {BadRequestException} 400 when any id is a payment or a non-provider transaction.
   */
  async markUnsent(owner: OwnerContext, dto: MarkChargesDto): Promise<MarkChargesResponse> {
    return this.#mark(owner, dto, 'unsent');
  }

  async #mark(owner: OwnerContext, dto: MarkChargesDto, mode: MarkMode): Promise<MarkChargesResponse> {
    const ids = [...new Set(dto.transaction_ids)];

    return this.transactionRepository.manager.transaction(async (manager: EntityManager) => {
      const rows = await this.chargesQuery.resolveForUpdate(manager, owner, ids);
      assertMarkable(ids, rows, mode);

      if (mode === 'unsent') {
        await this.chargesQuery.clear(manager, ids);
        return { charges: ids.map((id) => ({ id, sent_to_accountant_at: null })) };
      }

      const now = wholeSecond(new Date());
      await this.chargesQuery.stamp(manager, ids, now);
      const sentAt = new Map(rows.map((row) => [row.id, row.sentToAccountantAt]));

      return { charges: ids.map((id) => ({ id, sent_to_accountant_at: sentAt.get(id) ?? now })) };
    });
  }
}

/**
 * @param {AccountantChargeRow} row - A preview row.
 * @returns {AccountantChargeResponse} Its public view; `account` carries only the five provider fields.
 */
function serializeCharge(row: AccountantChargeRow): AccountantChargeResponse {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amount: formatAmount(row.amount, row.currency),
    sent_to_accountant_at: row.sentToAccountantAt,
    account: {
      id: row.accountId,
      name: row.accountName,
      bank_name: row.bankName,
      provider_tax_id: row.providerTaxId,
      currency: row.currency,
    },
  };
}

/**
 * @param {ResolvedMarkRow} row - A resolved transaction.
 * @param {MarkMode} mode - The mark route.
 * @returns {boolean} Whether the route accepts it: a provider-expense charge,
 *   whose account is `for_accountant` on `mark-sent` (un-marking stays possible
 *   once the flag is off).
 */
function isHandOffCharge(row: ResolvedMarkRow, mode: MarkMode): boolean {
  if (row.type !== PROVIDER_EXPENSE_TYPE || row.amount >= 0n) {
    return false;
  }

  return mode === 'unsent' || row.forAccountant === true;
}

/**
 * Classifies the resolved rows: ownership first (any unresolved id → 404, so
 * nothing is revealed about ids the owner can't see), then the hand-off rule
 * (→ 400 naming only the owner's rejected ids).
 * @param {number[]} ids - The de-duplicated posted ids.
 * @param {ResolvedMarkRow[]} rows - The owner's matching transactions.
 * @param {MarkMode} mode - The mark route.
 * @returns {void}
 * @throws {NotFoundException} The uniform 404 when any id is unresolved.
 * @throws {BadRequestException} 400 `VALIDATION_FAILED` when any id is not a hand-off charge.
 */
function assertMarkable(ids: number[], rows: ResolvedMarkRow[], mode: MarkMode): void {
  if (rows.length !== ids.length) {
    throw ownerNotFound();
  }

  const rejected = rows
    .filter((row) => !isHandOffCharge(row, mode))
    .map((row) => row.id)
    .sort((a, b) => a - b);

  if (rejected.length === 1) {
    throw handOffValidationFailed(`transaction ${rejected[0]} is not a hand-off charge`);
  }

  if (rejected.length > 1) {
    throw handOffValidationFailed(`transactions ${rejected.join(', ')} are not hand-off charges`);
  }
}

/**
 * @param {Date} date - An instant.
 * @returns {Date} The instant truncated to the second, as stored by the `DATETIME` column, so the
 *   reply matches later reads.
 */
function wholeSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}
