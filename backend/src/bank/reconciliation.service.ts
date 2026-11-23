import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AccountService } from './account.service.js';
import type {
  CreateReconciliationDto,
  ReconciliationTicksDto,
  UpdateReconciliationDto,
} from './dto/reconciliation.dto.js';
import { Reconciliation } from './entities/reconciliation.entity.js';
import { buildPagination, HISTORY_PER_PAGE } from './pagination.js';
import { ReconciliationLifecycleWriter } from './reconciliation-lifecycle.writer.js';
import { presentHistoryRow, type HistoryResponse, type StatementResponse } from './reconciliation-response.js';
import { ReconciliationTicksWriter } from './reconciliation-ticks.writer.js';
import { ReconciliationViewer } from './reconciliation-viewer.js';
import { ReconciliationQuery } from './reconciliation.query.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';

/**
 * Reconciliation statements of an account (lazy `BankModule`): a facade over the read paths and
 * the two writers. Every method first resolves the account (owner-scoped: the uniform 404 for an
 * account of another owner or context), then the statement by `{ id, accountId }`, so a statement
 * of a sibling account and an unknown id answer the same 404, never a 409.
 */
@Injectable()
export class ReconciliationService {
  private readonly reconciliationRepository: Repository<Reconciliation>;
  private readonly accounts: AccountService;
  private readonly query: ReconciliationQuery;
  private readonly viewer: ReconciliationViewer;
  private readonly lifecycle: ReconciliationLifecycleWriter;
  private readonly ticks: ReconciliationTicksWriter;

  /**
   * @param {Repository<Reconciliation>} reconciliationRepository - The reconciliation repository.
   * @param {AccountService} accounts - Owner-scoped account lookups.
   * @param {ReconciliationQuery} query - The history and count SQL.
   * @param {ReconciliationViewer} viewer - Computes and presents a statement.
   * @param {ReconciliationLifecycleWriter} lifecycle - Start, edit, cancel, finish and undo.
   * @param {ReconciliationTicksWriter} ticks - The bulk ticks write.
   */
  constructor(
  @InjectRepository(Reconciliation) reconciliationRepository: Repository<Reconciliation>,
    accounts: AccountService,
    query: ReconciliationQuery,
    viewer: ReconciliationViewer,
    lifecycle: ReconciliationLifecycleWriter,
    ticks: ReconciliationTicksWriter,
  ) {
    this.reconciliationRepository = reconciliationRepository;
    this.accounts = accounts;
    this.query = query;
    this.viewer = viewer;
    this.lifecycle = lifecycle;
    this.ticks = ticks;
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} page - The 1-based page.
   * @returns {Promise<HistoryResponse>} The history, newest first, 50 per page, the open statement
   *   first. `undoable` is true only on the latest finished statement while none is open;
   *   `transaction_count` comes from one grouped query.
   * @throws {NotFoundException} The uniform 404.
   */
  async list(owner: OwnerContext, accountId: number, page: number): Promise<HistoryResponse> {
    const account = await this.accounts.findOwned(owner, accountId);
    const { rows, total } = await this.query.historyPage(account.id, page);
    const counts = await this.query.transactionCounts(rows.map((row) => row.id));
    const undoableId = (await this.query.openStatement(account.id)) ? null : ((await this.query.latestFinished(account.id))?.id ?? null);

    return {
      reconciliations: rows.map((row) =>
        presentHistoryRow(row, counts.get(row.id) ?? 0, row.id === undoableId, account.currency)),
      pagination: buildPagination(page, HISTORY_PER_PAGE, total),
    };
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @returns {Promise<StatementResponse>} The statement with its live values.
   * @throws {NotFoundException} The uniform 404.
   */
  async get(owner: OwnerContext, accountId: number, id: number): Promise<StatementResponse> {
    const account = await this.accounts.findOwned(owner, accountId);
    const statement = await this.reconciliationRepository.findOneBy({ id, accountId: account.id });

    if (!statement) {
      throw ownerNotFound();
    }

    return this.viewer.view(statement, account);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {CreateReconciliationDto} dto - The validated body.
   * @returns {Promise<StatementResponse>} The new open statement.
   */
  async start(owner: OwnerContext, accountId: number, dto: CreateReconciliationDto): Promise<StatementResponse> {
    return this.lifecycle.start(owner, accountId, dto);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @param {UpdateReconciliationDto} dto - The validated body.
   * @returns {Promise<StatementResponse>} The edited statement.
   */
  async edit(owner: OwnerContext, accountId: number, id: number, dto: UpdateReconciliationDto): Promise<StatementResponse> {
    return this.lifecycle.edit(owner, accountId, id, dto);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @returns {Promise<void>}
   */
  async cancel(owner: OwnerContext, accountId: number, id: number): Promise<void> {
    await this.lifecycle.cancel(owner, accountId, id);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @param {ReconciliationTicksDto} dto - The validated body.
   * @returns {Promise<StatementResponse>} The statement after the ticks.
   */
  async tick(owner: OwnerContext, accountId: number, id: number, dto: ReconciliationTicksDto): Promise<StatementResponse> {
    return this.ticks.apply(owner, accountId, id, dto);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @returns {Promise<StatementResponse>} The finished statement.
   */
  async finish(owner: OwnerContext, accountId: number, id: number): Promise<StatementResponse> {
    return this.lifecycle.finish(owner, accountId, id);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} id - The statement id.
   * @returns {Promise<StatementResponse>} The reopened statement.
   */
  async undo(owner: OwnerContext, accountId: number, id: number): Promise<StatementResponse> {
    return this.lifecycle.undo(owner, accountId, id);
  }
}
