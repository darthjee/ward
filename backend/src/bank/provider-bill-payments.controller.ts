import { Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { BankModuleLoader } from './bank-module.loader.js';
import type { BillHistoryResponse } from './bill-history.service.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentOwner } from '../core/current-owner.decorator.js';
import { MinOrgRole } from '../core/min-org-role.decorator.js';
import { OrgRole } from '../core/org-role.js';
import type { OwnerContext } from '../core/owner-context.js';
import { OwnerScopedController } from '../core/owner-scoped.decorator.js';
import { parseId } from '../core/parse-id.js';
import { StrictBody } from '../core/strict-validation.pipe.js';
import { PayOccurrenceDto } from './dto/pay-occurrence.dto.js';
import type { OccurrenceResponse } from './occurrence-response.js';
import { parsePage } from './pagination.js';

/**
 * History and pay / skip / undo routes of one provider bill's occurrences (both kinds),
 * mounted under `bank/…` and `orgs/:orgId/bank/…`. Thin: parses the id
 * (malformed → uniform 404), loads the lazy `BankModule` and delegates to its
 * `ProviderBillPaymentService` / `BillHistoryService`. The history GET is
 * `user-scoped`, every write `never` cached. Bodies only
 * through `@StrictBody()`, never logged.
 */
@OwnerScopedController('bank')
export class ProviderBillPaymentsController {
  private readonly loader: BankModuleLoader;

  /**
   * @param {BankModuleLoader} loader - Loads the lazy `BankModule`.
   */
  constructor(loader: BankModuleLoader) {
    this.loader = loader;
  }

  /**
   * `GET <base>/provider-bills/:id/bill-payments.json?page=N`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @param {unknown} rawPage - The raw `page` query value.
   * @returns {Promise<BillHistoryResponse>} `{ payments, pagination }`.
   */
  @Get('provider-bills/:id/bill-payments.json')
  async history(
    @CurrentOwner() owner: OwnerContext,
      @Param('id') rawId: string,
      @Query('page') rawPage: unknown,
  ): Promise<BillHistoryResponse> {
    const id = parseId(rawId);
    const page = parsePage(rawPage);
    const { billHistory } = await this.loader.services();

    return billHistory.historyForBill(owner, id, page);
  }

  /**
   * `POST <base>/provider-bills/:id/occurrences/:dueDate/payment.json`. 201 with the occurrence.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @param {string} dueDate - The nominal due date (`YYYY-MM-DD`).
   * @param {PayOccurrenceDto} dto - `status`, and for `paid` the payment fields.
   * @returns {Promise<OccurrenceResponse>} The updated occurrence.
   */
  @Post('provider-bills/:id/occurrences/:dueDate/payment.json')
  @MinOrgRole(OrgRole.USER)
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.CREATED)
  async pay(
    @CurrentOwner() owner: OwnerContext,
      @Param('id') rawId: string,
      @Param('dueDate') dueDate: string,
      @StrictBody() dto: PayOccurrenceDto,
  ): Promise<OccurrenceResponse> {
    const id = parseId(rawId);
    const { providerBillPayments } = await this.loader.services();

    return providerBillPayments.pay(owner, id, dueDate, dto);
  }

  /**
   * `DELETE <base>/provider-bills/:id/occurrences/:dueDate/payment.json`. 204 on success.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @param {string} dueDate - The nominal due date (`YYYY-MM-DD`).
   * @returns {Promise<void>}
   */
  @Delete('provider-bills/:id/occurrences/:dueDate/payment.json')
  @MinOrgRole(OrgRole.ADMIN)
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.NO_CONTENT)
  async undo(
    @CurrentOwner() owner: OwnerContext,
      @Param('id') rawId: string,
      @Param('dueDate') dueDate: string,
  ): Promise<void> {
    const id = parseId(rawId);
    const { providerBillPayments } = await this.loader.services();

    await providerBillPayments.undo(owner, id, dueDate);
  }
}
