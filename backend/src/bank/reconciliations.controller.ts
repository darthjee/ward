import { Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { BankModuleLoader } from './bank-module.loader.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentOwner } from '../core/current-owner.decorator.js';
import { MinOrgRole } from '../core/min-org-role.decorator.js';
import { OrgRole } from '../core/org-role.js';
import type { OwnerContext } from '../core/owner-context.js';
import { OwnerScopedController } from '../core/owner-scoped.decorator.js';
import { parseId } from '../core/parse-id.js';
import { StrictBody } from '../core/strict-validation.pipe.js';
import {
  CreateReconciliationDto,
  EmptyReconciliationBodyDto,
  ReconciliationTicksDto,
  UpdateReconciliationDto,
} from './dto/reconciliation.dto.js';
import { parsePage } from './pagination.js';
import type { HistoryResponse, StatementResponse } from './reconciliation-response.js';

/**
 * Reconciliation (statement checkpoint) routes, mounted under `bank/…` and `orgs/:orgId/bank/…`.
 * Thin: parses the ids (malformed → uniform 404) and the page (invalid → 400), loads the lazy
 * `BankModule` and delegates to its `ReconciliationService`. The GETs are `user-scoped`, every
 * write `never`; start, edit, ticks and finish need `user`, cancel and undo `admin`. Bodies only
 * through `@StrictBody()`, never logged. A request rejected by the role 403 or the body 400 never
 * loads the lazy module.
 */
@OwnerScopedController('bank')
export class ReconciliationsController {
  private readonly loader: BankModuleLoader;

  /**
   * @param {BankModuleLoader} loader - Loads the lazy `BankModule`.
   */
  constructor(loader: BankModuleLoader) {
    this.loader = loader;
  }

  /**
   * `GET <base>/accounts/:accountId/reconciliations.json?page=N`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {unknown} rawPage - The raw `page` query value.
   * @returns {Promise<HistoryResponse>} `{ reconciliations, pagination }`.
   */
  @Get('accounts/:accountId/reconciliations.json')
  async list(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Query('page') rawPage: unknown,
  ): Promise<HistoryResponse> {
    const accountId = parseId(rawAccountId);
    const page = parsePage(rawPage);
    const { reconciliations } = await this.loader.services();

    return reconciliations.list(owner, accountId, page);
  }

  /**
   * `POST <base>/accounts/:accountId/reconciliations.json`. 201 with the new open statement.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {CreateReconciliationDto} dto - `statement_date` and `statement_balance`.
   * @returns {Promise<StatementResponse>} The statement.
   */
  @Post('accounts/:accountId/reconciliations.json')
  @MinOrgRole(OrgRole.USER)
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @StrictBody() dto: CreateReconciliationDto,
  ): Promise<StatementResponse> {
    const accountId = parseId(rawAccountId);
    const { reconciliations } = await this.loader.services();

    return reconciliations.start(owner, accountId, dto);
  }

  /**
   * `GET <base>/accounts/:accountId/reconciliations/:id.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {string} rawId - The raw `:id`.
   * @returns {Promise<StatementResponse>} The statement.
   */
  @Get('accounts/:accountId/reconciliations/:id.json')
  async show(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Param('id') rawId: string,
  ): Promise<StatementResponse> {
    const accountId = parseId(rawAccountId);
    const id = parseId(rawId);
    const { reconciliations } = await this.loader.services();

    return reconciliations.get(owner, accountId, id);
  }

  /**
   * `PATCH <base>/accounts/:accountId/reconciliations/:id.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {string} rawId - The raw `:id`.
   * @param {UpdateReconciliationDto} dto - The fields to change.
   * @returns {Promise<StatementResponse>} The edited statement.
   */
  @Patch('accounts/:accountId/reconciliations/:id.json')
  @MinOrgRole(OrgRole.USER)
  @CachePolicy(CacheClass.Never)
  async update(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Param('id') rawId: string,
      @StrictBody() dto: UpdateReconciliationDto,
  ): Promise<StatementResponse> {
    const accountId = parseId(rawAccountId);
    const id = parseId(rawId);
    const { reconciliations } = await this.loader.services();

    return reconciliations.edit(owner, accountId, id, dto);
  }

  /**
   * `DELETE <base>/accounts/:accountId/reconciliations/:id.json`. Cancels an open statement (204);
   * its ticks are dropped.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {string} rawId - The raw `:id`.
   * @returns {Promise<void>}
   */
  @Delete('accounts/:accountId/reconciliations/:id.json')
  @MinOrgRole(OrgRole.ADMIN)
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Param('id') rawId: string,
  ): Promise<void> {
    const accountId = parseId(rawAccountId);
    const id = parseId(rawId);
    const { reconciliations } = await this.loader.services();

    await reconciliations.cancel(owner, accountId, id);
  }

  /**
   * `PATCH <base>/accounts/:accountId/reconciliations/:id/ticks.json`. The bulk tick / untick.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {string} rawId - The raw `:id`.
   * @param {ReconciliationTicksDto} dto - `tick` and `untick` transaction ids.
   * @returns {Promise<StatementResponse>} The statement after the ticks.
   */
  @Patch('accounts/:accountId/reconciliations/:id/ticks.json')
  @MinOrgRole(OrgRole.USER)
  @CachePolicy(CacheClass.Never)
  async ticks(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Param('id') rawId: string,
      @StrictBody() dto: ReconciliationTicksDto,
  ): Promise<StatementResponse> {
    const accountId = parseId(rawAccountId);
    const id = parseId(rawId);
    const { reconciliations } = await this.loader.services();

    return reconciliations.tick(owner, accountId, id, dto);
  }

  /**
   * `POST <base>/accounts/:accountId/reconciliations/:id/finish.json` (body `{}`).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {string} rawId - The raw `:id`.
   * @param {EmptyReconciliationBodyDto} _body - The empty body (any field is a 400).
   * @returns {Promise<StatementResponse>} The finished statement.
   */
  @Post('accounts/:accountId/reconciliations/:id/finish.json')
  @MinOrgRole(OrgRole.USER)
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.OK)
  async finish(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Param('id') rawId: string,
      @StrictBody() _body: EmptyReconciliationBodyDto,
  ): Promise<StatementResponse> {
    const accountId = parseId(rawAccountId);
    const id = parseId(rawId);
    const { reconciliations } = await this.loader.services();

    return reconciliations.finish(owner, accountId, id);
  }

  /**
   * `POST <base>/accounts/:accountId/reconciliations/:id/undo.json` (body `{}`).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {string} rawId - The raw `:id`.
   * @param {EmptyReconciliationBodyDto} _body - The empty body (any field is a 400).
   * @returns {Promise<StatementResponse>} The statement, now open.
   */
  @Post('accounts/:accountId/reconciliations/:id/undo.json')
  @MinOrgRole(OrgRole.ADMIN)
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.OK)
  async undo(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Param('id') rawId: string,
      @StrictBody() _body: EmptyReconciliationBodyDto,
  ): Promise<StatementResponse> {
    const accountId = parseId(rawAccountId);
    const id = parseId(rawId);
    const { reconciliations } = await this.loader.services();

    return reconciliations.undo(owner, accountId, id);
  }
}
