import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import type { ReconciliationTicksDto } from './dto/reconciliation.dto.js';
import type { Account } from './entities/account.entity.js';
import { Reconciliation } from './entities/reconciliation.entity.js';
import { mapDeadlock, transactionNotEligible } from './reconciliation-conflicts.js';
import { ineligibilityReason } from './reconciliation-eligibility.js';
import { assertNotArchived, assertOpen, lockAccount, lockStatement } from './reconciliation-guards.js';
import type { StatementResponse } from './reconciliation-response.js';
import { normalizeTicks } from './reconciliation-ticks.js';
import { ReconciliationViewer } from './reconciliation-viewer.js';
import { ReconciliationQuery, type LockedTransaction } from './reconciliation.query.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';

/**
 * The bulk ticks write of an open statement (lazy `BankModule`). One DB transaction locks the
 * account row, then the statement row, then the transaction rows among the ids in ascending id
 * order (one narrow `SELECT … FOR UPDATE`), re-checks eligibility on the locked rows and applies
 * one bulk `UPDATE` per array. The whole batch is applied or none of it.
 */
@Injectable()
export class ReconciliationTicksWriter {
  private readonly reconciliationRepository: Repository<Reconciliation>;
  private readonly query: ReconciliationQuery;
  private readonly viewer: ReconciliationViewer;

  /**
   * @param {Repository<Reconciliation>} reconciliationRepository - The reconciliation repository.
   * @param {ReconciliationQuery} query - The bulk SQL.
   * @param {ReconciliationViewer} viewer - Computes and presents a statement.
   */
  constructor(
  @InjectRepository(Reconciliation) reconciliationRepository: Repository<Reconciliation>,
    query: ReconciliationQuery,
    viewer: ReconciliationViewer,
  ) {
    this.reconciliationRepository = reconciliationRepository;
    this.query = query;
    this.viewer = viewer;
  }

  /**
   * Ticks and unticks transactions on an open statement.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @param {ReconciliationTicksDto} dto - The validated body.
   * @returns {Promise<StatementResponse>} The statement, recomputed under the locks.
   * @throws {BadRequestException} 400 for an empty request or overlapping `tick` and `untick`.
   * @throws {NotFoundException} The uniform 404, also for an id that is not on the account.
   * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED`, `RECONCILIATION_FINISHED`, `TRANSACTION_NOT_ELIGIBLE`,
   *   `CONCURRENT_UPDATE`.
   */
  async apply(owner: OwnerContext, accountId: number, id: number, dto: ReconciliationTicksDto): Promise<StatementResponse> {
    const { tick, untick } = normalizeTicks(dto);
    const ids = [...new Set([...tick, ...untick])].sort((a, b) => a - b);

    return mapDeadlock(() => this.reconciliationRepository.manager.transaction(async (manager) => {
      const account = await lockAccount(manager, owner, accountId);
      const statement = await lockStatement(manager, account.id, id);
      const rows = await this.query.lockTransactions(manager, account.id, ids);

      if (rows.length !== ids.length) {
        throw ownerNotFound();
      }

      assertNotArchived(account);
      assertOpen(statement);
      this.#assertEligible(rows, new Set(tick), statement, account);
      await this.#writeTicks(manager, statement, { tick, untick });

      return this.viewer.view(statement, account, manager);
    }));
  }

  #assertEligible(rows: LockedTransaction[], ticked: Set<number>, statement: Reconciliation, account: Account): void {
    if (rows.some((row) => ticked.has(row.id) && ineligibilityReason(row, statement, account) !== null)) {
      throw transactionNotEligible();
    }
  }

  async #writeTicks(manager: EntityManager, statement: Reconciliation, ids: { tick: number[]; untick: number[] }): Promise<void> {
    if (ids.tick.length > 0) {
      await this.query.tick(manager, statement.accountId, statement.id, ids.tick);
    }

    if (ids.untick.length > 0) {
      await this.query.untick(manager, statement.accountId, statement.id, ids.untick);
    }
  }
}
