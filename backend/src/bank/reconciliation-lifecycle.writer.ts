import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { AccountBalancesQuery } from './account-balances.query.js';
import type { CreateReconciliationDto, UpdateReconciliationDto } from './dto/reconciliation.dto.js';
import type { Account } from './entities/account.entity.js';
import { Reconciliation } from './entities/reconciliation.entity.js';
import { isBalanced, reconciliationDifference } from './reconciliation-balance.js';
import {
  mapDeadlock,
  mapOpenClash,
  reconciliationFinished,
  reconciliationNotFinished,
  reconciliationNotLatest,
  reconciliationOpen,
  reconciliationUnbalanced,
} from './reconciliation-conflicts.js';
import {
  assertAfterLatestFinished,
  assertNotArchived,
  assertNotBeforeOpening,
  assertOpen,
  lockAccount,
  lockStatement,
  parseStatementBalance,
} from './reconciliation-guards.js';
import type { StatementResponse } from './reconciliation-response.js';
import { ReconciliationViewer } from './reconciliation-viewer.js';
import { ReconciliationQuery } from './reconciliation.query.js';
import type { OwnerContext } from '../core/owner-context.js';

/**
 * The lifecycle writes of a statement (lazy `BankModule`): start, edit, cancel, finish and undo.
 * Each one runs in **one** DB transaction that locks the account row, then the statement row
 * (`FOR UPDATE`, as `BillPaymentWriter` does), applies the check order of the spec (path 404,
 * account-dependent 400, `ACCOUNT_ARCHIVED`, then the state 409s) and returns the statement
 * recomputed under those locks. A deadlock victim maps to 409 `CONCURRENT_UPDATE`; the start and
 * undo races into the unique `open_key` map to 409 `RECONCILIATION_OPEN`.
 */
@Injectable()
export class ReconciliationLifecycleWriter {
  private readonly reconciliationRepository: Repository<Reconciliation>;
  private readonly query: ReconciliationQuery;
  private readonly balances: AccountBalancesQuery;
  private readonly viewer: ReconciliationViewer;

  /**
   * @param {Repository<Reconciliation>} reconciliationRepository - The reconciliation repository.
   * @param {ReconciliationQuery} query - The bulk SQL.
   * @param {AccountBalancesQuery} balances - The cleared balance and ticked sum SQL.
   * @param {ReconciliationViewer} viewer - Computes and presents a statement.
   */
  constructor(
  @InjectRepository(Reconciliation) reconciliationRepository: Repository<Reconciliation>,
    query: ReconciliationQuery,
    balances: AccountBalancesQuery,
    viewer: ReconciliationViewer,
  ) {
    this.reconciliationRepository = reconciliationRepository;
    this.query = query;
    this.balances = balances;
    this.viewer = viewer;
  }

  /**
   * Starts a statement.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {CreateReconciliationDto} dto - The validated body.
   * @returns {Promise<StatementResponse>} The new open statement.
   * @throws {NotFoundException} The uniform 404.
   * @throws {BadRequestException} 400 for a balance beyond the bound or a date before the opening date.
   * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED`, `RECONCILIATION_OPEN`, `RECONCILIATION_OUT_OF_ORDER`,
   *   `CONCURRENT_UPDATE`.
   */
  async start(owner: OwnerContext, accountId: number, dto: CreateReconciliationDto): Promise<StatementResponse> {
    return this.#write(true, async (manager) => {
      const account = await lockAccount(manager, owner, accountId);
      const statementBalance = parseStatementBalance(dto.statement_balance, account);
      assertNotBeforeOpening(dto.statement_date, account);
      assertNotArchived(account);

      if (await this.query.openStatement(account.id, manager)) {
        throw reconciliationOpen();
      }

      assertAfterLatestFinished(dto.statement_date, await this.query.latestFinished(account.id, manager));

      const statements = manager.getRepository(Reconciliation);
      const saved = await statements.save(statements.create({
        accountId: account.id,
        statementDate: dto.statement_date,
        statementBalance,
        reconciledAt: null,
      }));

      return this.viewer.view(saved, account, manager);
    });
  }

  /**
   * Edits an open statement's date and / or balance; moving the date earlier unticks the rows
   * that now fall after it.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @param {UpdateReconciliationDto} dto - The validated body.
   * @returns {Promise<StatementResponse>} The updated statement.
   * @throws {NotFoundException} The uniform 404.
   * @throws {BadRequestException} 400 for a balance beyond the bound or a date before the opening date.
   * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED`, `RECONCILIATION_FINISHED`, `RECONCILIATION_OUT_OF_ORDER`,
   *   `CONCURRENT_UPDATE`.
   */
  async edit(owner: OwnerContext, accountId: number, id: number, dto: UpdateReconciliationDto): Promise<StatementResponse> {
    return this.#write(false, async (manager) => {
      const account = await lockAccount(manager, owner, accountId);
      const statement = await lockStatement(manager, account.id, id);
      const statementBalance = dto.statement_balance === undefined ? undefined : parseStatementBalance(dto.statement_balance, account);

      if (dto.statement_date !== undefined) {
        assertNotBeforeOpening(dto.statement_date, account);
      }

      assertNotArchived(account);
      assertOpen(statement);
      await this.#applyEdit(manager, statement, { statementDate: dto.statement_date, statementBalance });

      return this.viewer.view(statement, account, manager);
    });
  }

  /**
   * Cancels an open statement: it is deleted and the foreign key drops its ticks.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @returns {Promise<void>}
   * @throws {NotFoundException} The uniform 404.
   * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED`, `RECONCILIATION_FINISHED`, `CONCURRENT_UPDATE`.
   */
  async cancel(owner: OwnerContext, accountId: number, id: number): Promise<void> {
    await this.#write(false, async (manager) => {
      const account = await lockAccount(manager, owner, accountId);
      const statement = await lockStatement(manager, account.id, id);
      assertNotArchived(account);
      assertOpen(statement);
      await manager.getRepository(Reconciliation).delete({ id: statement.id });
    });
  }

  /**
   * Finishes an open statement at difference zero (recomputed under the lock).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @returns {Promise<StatementResponse>} The finished statement.
   * @throws {NotFoundException} The uniform 404.
   * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED`, `RECONCILIATION_FINISHED`, `RECONCILIATION_UNBALANCED`,
   *   `CONCURRENT_UPDATE`.
   */
  async finish(owner: OwnerContext, accountId: number, id: number): Promise<StatementResponse> {
    return this.#write(false, async (manager) => {
      const account = await lockAccount(manager, owner, accountId);
      const statement = await lockStatement(manager, account.id, id);
      assertNotArchived(account);
      assertOpen(statement);
      await this.query.lockTicked(manager, account.id, statement.id);
      await this.#assertBalanced(manager, account, statement);

      const at = new Date();

      if (!(await this.query.markFinished(manager, statement.id, at))) {
        throw reconciliationFinished();
      }

      Object.assign(statement, { reconciledAt: at, updatedAt: at });

      return this.viewer.view(statement, account, manager);
    });
  }

  /**
   * Undoes the latest finished statement (no statement open): it returns to `open` with its ticks kept.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @returns {Promise<StatementResponse>} The reopened statement.
   * @throws {NotFoundException} The uniform 404.
   * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED`, `RECONCILIATION_NOT_FINISHED`, `RECONCILIATION_OPEN`,
   *   `RECONCILIATION_NOT_LATEST`, `CONCURRENT_UPDATE`.
   */
  async undo(owner: OwnerContext, accountId: number, id: number): Promise<StatementResponse> {
    return this.#write(true, async (manager) => {
      const account = await lockAccount(manager, owner, accountId);
      const statement = await lockStatement(manager, account.id, id);
      assertNotArchived(account);
      await this.#assertUndoable(manager, account, statement);

      if (!(await this.query.reopen(manager, statement.id))) {
        throw reconciliationNotFinished();
      }

      Object.assign(statement, { reconciledAt: null, updatedAt: new Date() });

      return this.viewer.view(statement, account, manager);
    });
  }

  // Wraps a write in its transaction; the writes that can hit the unique `open_key` map it too.
  async #write<T>(mapsOpenClash: boolean, work: (manager: EntityManager) => Promise<T>): Promise<T> {
    const run = (): Promise<T> => this.reconciliationRepository.manager.transaction(work);

    return mapDeadlock(mapsOpenClash ? () => mapOpenClash(run) : run);
  }

  async #applyEdit(
    manager: EntityManager,
    statement: Reconciliation,
    changes: { statementDate: string | undefined; statementBalance: bigint | undefined },
  ): Promise<void> {
    const { statementDate, statementBalance } = changes;
    const moved = statementDate !== undefined && statementDate !== statement.statementDate;

    if (moved) {
      assertAfterLatestFinished(statementDate, await this.query.latestFinished(statement.accountId, manager));
    }

    const movedEarlier = moved && statementDate < statement.statementDate;

    if (statementBalance !== undefined) {
      statement.statementBalance = statementBalance;
    }

    if (moved) {
      statement.statementDate = statementDate;
    }

    await manager.getRepository(Reconciliation).save(statement);

    if (movedEarlier) {
      await this.query.untickAfter(manager, statement.accountId, statement.id, statementDate);
    }
  }

  async #assertBalanced(manager: EntityManager, account: Account, statement: Reconciliation): Promise<void> {
    const cleared = await this.balances.clearedBalance(account, manager);
    const ticked = await this.balances.tickedSum(account.id, statement.id, manager);

    if (!isBalanced(reconciliationDifference(statement.statementBalance, cleared, ticked))) {
      throw reconciliationUnbalanced();
    }
  }

  async #assertUndoable(manager: EntityManager, account: Account, statement: Reconciliation): Promise<void> {
    if (statement.reconciledAt === null) {
      throw reconciliationNotFinished();
    }

    if (await this.query.openStatement(account.id, manager)) {
      throw reconciliationOpen();
    }

    if ((await this.query.latestFinished(account.id, manager))?.id !== statement.id) {
      throw reconciliationNotLatest();
    }
  }
}
