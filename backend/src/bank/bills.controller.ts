import { Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, ValidationPipe } from '@nestjs/common';
import { BankModuleLoader } from './bank-module.loader.js';
import type { BillListResponse, BillResponse } from './bill-response.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentOwner } from '../core/current-owner.decorator.js';
import type { OwnerContext } from '../core/owner-context.js';
import { OwnerScopedController } from '../core/owner-scoped.decorator.js';
import { parseId } from '../core/parse-id.js';
import { StrictBody } from '../core/strict-validation.pipe.js';
import { CreateBillDto } from './dto/create-bill.dto.js';
import { ListBillsQueryDto } from './dto/list-bills-query.dto.js';
import { UpdateBillDto } from './dto/update-bill.dto.js';
import { parsePage } from './pagination.js';

const QUERY_PIPE = new ValidationPipe({ whitelist: true, transform: true });

/**
 * One-off bill routes, mounted under `bank/…` and `orgs/:orgId/bank/…`. Thin:
 * parses the ids (malformed → uniform 404) and the page (invalid → 400),
 * loads the lazy `BankModule` and delegates to its `BillService`. GETs are
 * `user-scoped`, writes `never`. Bodies only through `@StrictBody()`, never
 * logged.
 */
@OwnerScopedController('bank')
export class BillsController {
  private readonly loader: BankModuleLoader;

  /**
   * @param {BankModuleLoader} loader - Loads the lazy `BankModule`.
   */
  constructor(loader: BankModuleLoader) {
    this.loader = loader;
  }

  /**
   * `GET <base>/bills.json?provider_account_id=&page=`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {ListBillsQueryDto} query - The optional provider filter.
   * @param {unknown} rawPage - The raw `page` query value.
   * @returns {Promise<BillListResponse>} `{ bills, pagination }`.
   */
  @Get('bills.json')
  async list(
    @CurrentOwner() owner: OwnerContext,
      @Query(QUERY_PIPE) query: ListBillsQueryDto,
      @Query('page') rawPage: unknown,
  ): Promise<BillListResponse> {
    const page = parsePage(rawPage);
    const providerAccountId = query.provider_account_id === undefined ? undefined : Number(query.provider_account_id);
    const { bills } = await this.loader.services();

    return bills.list(owner, providerAccountId, page);
  }

  /**
   * `POST <base>/bills.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {CreateBillDto} dto - The bill fields.
   * @returns {Promise<BillResponse>} The created bill.
   */
  @Post('bills.json')
  @CachePolicy(CacheClass.Never)
  async create(@CurrentOwner() owner: OwnerContext, @StrictBody() dto: CreateBillDto): Promise<BillResponse> {
    const { bills } = await this.loader.services();

    return bills.create(owner, dto);
  }

  /**
   * `GET <base>/bills/:id.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @returns {Promise<BillResponse>} The bill.
   */
  @Get('bills/:id.json')
  async find(@CurrentOwner() owner: OwnerContext, @Param('id') rawId: string): Promise<BillResponse> {
    const id = parseId(rawId);
    const { bills } = await this.loader.services();

    return bills.find(owner, id);
  }

  /**
   * `PATCH <base>/bills/:id.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @param {UpdateBillDto} dto - The fields to change.
   * @returns {Promise<BillResponse>} The updated bill.
   */
  @Patch('bills/:id.json')
  @CachePolicy(CacheClass.Never)
  async update(
    @CurrentOwner() owner: OwnerContext,
      @Param('id') rawId: string,
      @StrictBody() dto: UpdateBillDto,
  ): Promise<BillResponse> {
    const id = parseId(rawId);
    const { bills } = await this.loader.services();

    return bills.update(owner, id, dto);
  }

  /**
   * `DELETE <base>/bills/:id.json`. 204 on success.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @returns {Promise<void>}
   */
  @Delete('bills/:id.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentOwner() owner: OwnerContext, @Param('id') rawId: string): Promise<void> {
    const id = parseId(rawId);
    const { bills } = await this.loader.services();

    await bills.delete(owner, id);
  }
}
