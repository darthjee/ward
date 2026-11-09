import { Get, HttpCode, HttpStatus, Post, Query, ValidationPipe } from '@nestjs/common';
import type { AccountantChargesResponse, MarkChargesResponse } from './accountant.service.js';
import { BankModuleLoader } from './bank-module.loader.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentOwner } from '../core/current-owner.decorator.js';
import type { OwnerContext } from '../core/owner-context.js';
import { OwnerScopedController } from '../core/owner-scoped.decorator.js';
import { StrictBody } from '../core/strict-validation.pipe.js';
import { AccountantChargesQueryDto } from './dto/accountant-charges-query.dto.js';
import { MarkChargesDto } from './dto/mark-charges.dto.js';

const QUERY_PIPE = new ValidationPipe({ whitelist: true, transform: true });

/**
 * Accountant hand-off routes for provider-expense charges, mounted under
 * `bank/…` and `orgs/:orgId/bank/…`. Thin: validates the query / body, loads
 * the lazy `BankModule` and delegates to its `AccountantService`. The preview
 * is `user-scoped` (class level, from `@OwnerScopedController`), the mark
 * routes `never`. Bodies only through `@StrictBody()`, never logged.
 */
@OwnerScopedController('bank')
export class AccountantController {
  private readonly loader: BankModuleLoader;

  /**
   * @param {BankModuleLoader} loader - Loads the lazy `BankModule`.
   */
  constructor(loader: BankModuleLoader) {
    this.loader = loader;
  }

  /**
   * `GET <base>/accountant/charges.json?from=&to=&include_sent=false`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {AccountantChargesQueryDto} query - `from`, `to` and `include_sent`.
   * @returns {Promise<AccountantChargesResponse>} The preview envelope.
   */
  @Get('accountant/charges.json')
  async charges(
    @CurrentOwner() owner: OwnerContext,
      @Query(QUERY_PIPE) query: AccountantChargesQueryDto,
  ): Promise<AccountantChargesResponse> {
    const { accountant } = await this.loader.services();

    return accountant.preview(owner, query);
  }

  /**
   * `POST <base>/accountant/mark-sent.json`. 200 on success.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {MarkChargesDto} dto - `transaction_ids`.
   * @returns {Promise<MarkChargesResponse>} Every posted id with its mark.
   */
  @Post('accountant/mark-sent.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.OK)
  async markSent(@CurrentOwner() owner: OwnerContext, @StrictBody() dto: MarkChargesDto): Promise<MarkChargesResponse> {
    const { accountant } = await this.loader.services();

    return accountant.markSent(owner, dto);
  }

  /**
   * `POST <base>/accountant/mark-unsent.json`. 200 on success.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {MarkChargesDto} dto - `transaction_ids`.
   * @returns {Promise<MarkChargesResponse>} Every posted id with a `null` mark.
   */
  @Post('accountant/mark-unsent.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.OK)
  async markUnsent(@CurrentOwner() owner: OwnerContext, @StrictBody() dto: MarkChargesDto): Promise<MarkChargesResponse> {
    const { accountant } = await this.loader.services();

    return accountant.markUnsent(owner, dto);
  }
}
