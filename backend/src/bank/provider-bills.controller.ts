import { Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, ValidationPipe } from '@nestjs/common';
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
import { CreateProviderBillDto } from './dto/create-provider-bill.dto.js';
import { ListProviderBillsQueryDto } from './dto/list-provider-bills-query.dto.js';
import { UpdateProviderBillDto } from './dto/update-provider-bill.dto.js';
import { parsePage } from './pagination.js';
import type { ProviderBillListResponse, ProviderBillResponse } from './provider-bill-response.js';

const QUERY_PIPE = new ValidationPipe({ whitelist: true, transform: true });

/**
 * Provider bill routes, mounted under `bank/…` and `orgs/:orgId/bank/…`. Thin:
 * parses the ids (malformed → uniform 404) and the page (invalid → 400),
 * loads the lazy `BankModule` and delegates to its `ProviderBillService`.
 * GETs are `user-scoped`, writes `never`. Bodies only through `@StrictBody()`,
 * never logged.
 */
@OwnerScopedController('bank')
export class ProviderBillsController {
  private readonly loader: BankModuleLoader;

  /**
   * @param {BankModuleLoader} loader - Loads the lazy `BankModule`.
   */
  constructor(loader: BankModuleLoader) {
    this.loader = loader;
  }

  /**
   * `GET <base>/accounts/:accountId/provider-bills.json?kind=&page=`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {ListProviderBillsQueryDto} query - The optional `kind` filter.
   * @param {unknown} rawPage - The raw `page` query value.
   * @returns {Promise<ProviderBillListResponse>} `{ provider_bills, pagination }`.
   */
  @Get('accounts/:accountId/provider-bills.json')
  async list(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Query(QUERY_PIPE) query: ListProviderBillsQueryDto,
      @Query('page') rawPage: unknown,
  ): Promise<ProviderBillListResponse> {
    const accountId = parseId(rawAccountId);
    const page = parsePage(rawPage);
    const { providerBills } = await this.loader.services();

    return providerBills.list(owner, accountId, query.kind, page);
  }

  /**
   * `POST <base>/accounts/:accountId/provider-bills.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {CreateProviderBillDto} dto - The bill fields.
   * @returns {Promise<ProviderBillResponse>} The created bill.
   */
  @Post('accounts/:accountId/provider-bills.json')
  @MinOrgRole(OrgRole.USER)
  @CachePolicy(CacheClass.Never)
  async create(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @StrictBody() dto: CreateProviderBillDto,
  ): Promise<ProviderBillResponse> {
    const accountId = parseId(rawAccountId);
    const { providerBills } = await this.loader.services();

    return providerBills.create(owner, accountId, dto);
  }

  /**
   * `GET <base>/provider-bills/:id.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @returns {Promise<ProviderBillResponse>} The bill.
   */
  @Get('provider-bills/:id.json')
  async find(@CurrentOwner() owner: OwnerContext, @Param('id') rawId: string): Promise<ProviderBillResponse> {
    const id = parseId(rawId);
    const { providerBills } = await this.loader.services();

    return providerBills.find(owner, id);
  }

  /**
   * `PATCH <base>/provider-bills/:id.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @param {UpdateProviderBillDto} dto - The fields to change.
   * @returns {Promise<ProviderBillResponse>} The updated bill.
   */
  @Patch('provider-bills/:id.json')
  @MinOrgRole(OrgRole.USER)
  @CachePolicy(CacheClass.Never)
  async update(
    @CurrentOwner() owner: OwnerContext,
      @Param('id') rawId: string,
      @StrictBody() dto: UpdateProviderBillDto,
  ): Promise<ProviderBillResponse> {
    const id = parseId(rawId);
    const { providerBills } = await this.loader.services();

    return providerBills.update(owner, id, dto);
  }

  /**
   * `DELETE <base>/provider-bills/:id.json`. 204 on success.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @returns {Promise<void>}
   */
  @Delete('provider-bills/:id.json')
  @MinOrgRole(OrgRole.ADMIN)
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentOwner() owner: OwnerContext, @Param('id') rawId: string): Promise<void> {
    const id = parseId(rawId);
    const { providerBills } = await this.loader.services();

    await providerBills.delete(owner, id);
  }
}
