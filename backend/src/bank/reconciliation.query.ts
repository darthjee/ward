import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, type EntityManager, type Repository } from 'typeorm';
import { Reconciliation } from './entities/reconciliation.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { LEDGER_PER_PAGE } from './pagination.js';

/** Statements per history page. */
export const HISTORY_PER_PAGE = LEDGER_PER_PAGE;

/** The narrow columns of a transaction row locked by a ticks request (never the whole entity). */
export type LockedTransaction = Pick<Transaction, 'id' | 'date' | 'amount' | 'reconciliationId'>;

/** One history page: the statements newest first, and the account's total count. */
export interface HistoryPage {
  rows: Reconciliation[];
  total: number;
}

/**
 * The bulk and aggregate SQL of the reconciliation routes, in its own fakeable class (the e2e
 * specs swap it for an in-memory twin, the MySQL integration spec covers the real SQL). Every
 * method is one statement: no entity hydration beyond the locked narrow columns, never one query
 * per row (see `docs/agents/specs/reconciliation/security.md`, *Memory*). The write helpers take
 * the transaction's `EntityManager`. Callers have already scoped the account to its owner.
 */
@Injectable()
export class ReconciliationQuery {
  private readonly reconciliationRepository: Repository<Reconciliation>;
  private readonly transactionRepository: Repository<Transaction>;

  /**
   * @param {Repository<Reconciliation>} reconciliationRepository - The reconciliation repository.
   * @param {Repository<Transaction>} transactionRepository - The transaction repository.
   */
  constructor(
  @InjectRepository(Reconciliation) reconciliationRepository: Repository<Reconciliation>,
    @InjectRepository(Transaction) transactionRepository: Repository<Transaction>,
  ) {
    this.reconciliationRepository = reconciliationRepository;
    this.transactionRepository = transactionRepository;
  }

  /**
   * Locks (`FOR UPDATE`, ascending id) the account's transactions among `ids`. A foreign or
   * unknown id is simply absent from the result.
   * @param {EntityManager} manager - The write transaction's manager.
   * @param {number} accountId - The account id.
   * @param {number[]} ids - At most 50 transaction ids.
   * @returns {Promise<LockedTransaction[]>} The narrow columns of the rows found, by id.
   */
  async lockTransactions(manager: EntityManager, accountId: number, ids: number[]): Promise<LockedTransaction[]> {
    return manager
      .getRepository(Transaction)
      .createQueryBuilder('t')
      .select(['t.id', 't.date', 't.amount', 't.reconciliationId'])
      .where('t.account_id = :account', { account: accountId })
      .andWhere('t.id IN (:...ids)', { ids })
      .orderBy('t.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
  }

  /**
   * Ticks the rows on the statement with one bulk `UPDATE`.
   * @param {EntityManager} manager - The write transaction's manager.
   * @param {number} accountId - The account id.
   * @param {number} statementId - The open statement id.
   * @param {number[]} ids - The (already locked and checked) transaction ids.
   * @returns {Promise<void>}
   */
  async tick(manager: EntityManager, accountId: number, statementId: number, ids: number[]): Promise<void> {
    await manager
      .getRepository(Transaction)
      .createQueryBuilder()
      .update()
      .set({ reconciliationId: statementId })
      .where('account_id = :account', { account: accountId })
      .andWhere('id IN (:...ids)', { ids })
      .execute();
  }

  /**
   * Unticks the rows ticked on the statement with one bulk `UPDATE`; a row that is unlinked, or
   * linked to another statement, is left alone.
   * @param {EntityManager} manager - The write transaction's manager.
   * @param {number} accountId - The account id.
   * @param {number} statementId - The open statement id.
   * @param {number[]} ids - The transaction ids.
   * @returns {Promise<void>}
   */
  async untick(manager: EntityManager, accountId: number, statementId: number, ids: number[]): Promise<void> {
    await manager
      .getRepository(Transaction)
      .createQueryBuilder()
      .update()
      .set({ reconciliationId: null })
      .where('account_id = :account', { account: accountId })
      .andWhere('reconciliation_id = :statement', { statement: statementId })
      .andWhere('id IN (:...ids)', { ids })
      .execute();
  }

  /**
   * Unticks the rows of the statement dated after `statementDate` (an edit moving the date earlier).
   * @param {EntityManager} manager - The write transaction's manager.
   * @param {number} accountId - The account id.
   * @param {number} statementId - The open statement id.
   * @param {string} statementDate - The statement's new date (`YYYY-MM-DD`).
   * @returns {Promise<void>}
   */
  async untickAfter(manager: EntityManager, accountId: number, statementId: number, statementDate: string): Promise<void> {
    await manager
      .getRepository(Transaction)
      .createQueryBuilder()
      .update()
      .set({ reconciliationId: null })
      .where('account_id = :account', { account: accountId })
      .andWhere('reconciliation_id = :statement', { statement: statementId })
      .andWhere('date > :date', { date: statementDate })
      .execute();
  }

  /**
   * Finishes the statement, guarded by `reconciled_at IS NULL`.
   * @param {EntityManager} manager - The write transaction's manager.
   * @param {number} statementId - The statement id.
   * @param {Date} at - The finish time.
   * @returns {Promise<boolean>} `true` when the statement was open and is now finished.
   */
  async markFinished(manager: EntityManager, statementId: number, at: Date): Promise<boolean> {
    const result = await manager
      .getRepository(Reconciliation)
      .update({ id: statementId, reconciledAt: IsNull() }, { reconciledAt: at });

    return result.affected === 1;
  }

  /**
   * Reopens the statement (undo), guarded by `reconciled_at IS NOT NULL`. The ticks are kept. The
   * unique `open_key` makes this fail with `ER_DUP_ENTRY` when the account has another open statement.
   * @param {EntityManager} manager - The write transaction's manager.
   * @param {number} statementId - The statement id.
   * @returns {Promise<boolean>} `true` when the statement was finished and is now open.
   */
  async reopen(manager: EntityManager, statementId: number): Promise<boolean> {
    const result = await manager
      .getRepository(Reconciliation)
      .update({ id: statementId, reconciledAt: Not(IsNull()) }, { reconciledAt: null });

    return result.affected === 1;
  }

  /**
   * Counts the transactions of each statement with **one** grouped query.
   * @param {number[]} statementIds - At most 50 statement ids.
   * @returns {Promise<Map<number, number>>} The count by statement id (`0` for a statement with no rows).
   */
  async transactionCounts(statementIds: number[]): Promise<Map<number, number>> {
    const counts = new Map(statementIds.map((id) => [id, 0]));

    if (statementIds.length === 0) {
      return counts;
    }

    const rows: Array<{ statementId: number | string; total: number | string }> = await this.transactionRepository
      .createQueryBuilder('t')
      .select('t.reconciliation_id', 'statementId')
      .addSelect('COUNT(*)', 'total')
      .where('t.reconciliation_id IN (:...ids)', { ids: statementIds })
      .groupBy('t.reconciliation_id')
      .getRawMany();

    for (const row of rows) {
      counts.set(Number(row.statementId), Number(row.total));
    }

    return counts;
  }

  /**
   * @param {number} accountId - The account id.
   * @param {EntityManager} [manager] - The write transaction's manager, when inside one.
   * @returns {Promise<Reconciliation | null>} The account's latest finished statement, or `null`.
   */
  async latestFinished(accountId: number, manager?: EntityManager): Promise<Reconciliation | null> {
    return this.#repository(manager).findOne({
      where: { accountId, reconciledAt: Not(IsNull()) },
      order: { statementDate: 'DESC', id: 'DESC' },
    });
  }

  /**
   * @param {number} accountId - The account id.
   * @param {EntityManager} [manager] - The write transaction's manager, when inside one.
   * @returns {Promise<Reconciliation | null>} The account's open statement, or `null`.
   */
  async openStatement(accountId: number, manager?: EntityManager): Promise<Reconciliation | null> {
    return this.#repository(manager).findOneBy({ accountId, reconciledAt: IsNull() });
  }

  /**
   * @param {number} accountId - The account id.
   * @param {number} page - The 1-based page.
   * @returns {Promise<HistoryPage>} The page's statements newest first (`statement_date`, then
   *   `id`, descending) and the total count. The open statement, always the latest date, comes first.
   */
  async historyPage(accountId: number, page: number): Promise<HistoryPage> {
    const [rows, total] = await this.reconciliationRepository.findAndCount({
      where: { accountId },
      order: { statementDate: 'DESC', id: 'DESC' },
      skip: (page - 1) * HISTORY_PER_PAGE,
      take: HISTORY_PER_PAGE,
    });

    return { rows, total };
  }

  #repository(manager?: EntityManager): Repository<Reconciliation> {
    return manager ? manager.getRepository(Reconciliation) : this.reconciliationRepository;
  }
}
