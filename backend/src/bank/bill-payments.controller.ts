import { Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { BankModuleLoader } from './bank-module.loader.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentOwner } from '../core/current-owner.decorator.js';
import type { OwnerContext } from '../core/owner-context.js';
import { OwnerScopedController } from '../core/owner-scoped.decorator.js';
import { parseId } from '../core/parse-id.js';
import { StrictBody } from '../core/strict-validation.pipe.js';
import { PayOccurrenceDto } from './dto/pay-occurrence.dto.js';
import type { OccurrenceResponse } from './occurrence-response.js';

/**
 * Pay / skip / undo routes of bill occurrences, mounted under `bank/…` and
 * `orgs/:orgId/bank/…`. Thin: parses the ids (malformed → uniform 404), loads
 * the lazy `BankModule` and delegates to its `BillPaymentService`. Every route
 * is `never`. Bodies only through `@StrictBody()`, never logged.
 */
@OwnerScopedController('bank')
export class BillPaymentsController {
  private readonly loader: BankModuleLoader;

  /**
   * @param {BankModuleLoader} loader - Loads the lazy `BankModule`.
   */
  constructor(loader: BankModuleLoader) {
    this.loader = loader;
  }

  /**
   * `POST <base>/accounts/:accountId/occurrences/:dueDate/payment.json`. 201 with the occurrence.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {string} dueDate - The nominal due date (`YYYY-MM-DD`).
   * @param {PayOccurrenceDto} dto - `status`, and for `paid` the payment fields.
   * @returns {Promise<OccurrenceResponse>} The updated occurrence.
   */
  @Post('accounts/:accountId/occurrences/:dueDate/payment.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.CREATED)
  async payOccurrence(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Param('dueDate') dueDate: string,
      @StrictBody() dto: PayOccurrenceDto,
  ): Promise<OccurrenceResponse> {
    const accountId = parseId(rawAccountId);
    const { billPayments } = await this.loader.services();

    return billPayments.payOccurrence(owner, accountId, dueDate, dto);
  }

  /**
   * `DELETE <base>/accounts/:accountId/occurrences/:dueDate/payment.json`. 204 on success.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {string} dueDate - The nominal due date (`YYYY-MM-DD`).
   * @returns {Promise<void>}
   */
  @Delete('accounts/:accountId/occurrences/:dueDate/payment.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.NO_CONTENT)
  async undoOccurrence(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Param('dueDate') dueDate: string,
  ): Promise<void> {
    const accountId = parseId(rawAccountId);
    const { billPayments } = await this.loader.services();

    await billPayments.undoOccurrence(owner, accountId, dueDate);
  }

  /**
   * `POST <base>/bills/:id/payment.json`. 201 with the occurrence.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @param {PayOccurrenceDto} dto - `status`, and for `paid` the payment fields.
   * @returns {Promise<OccurrenceResponse>} The updated occurrence.
   */
  @Post('bills/:id/payment.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.CREATED)
  async payBill(
    @CurrentOwner() owner: OwnerContext,
      @Param('id') rawId: string,
      @StrictBody() dto: PayOccurrenceDto,
  ): Promise<OccurrenceResponse> {
    const id = parseId(rawId);
    const { billPayments } = await this.loader.services();

    return billPayments.payBill(owner, id, dto);
  }

  /**
   * `DELETE <base>/bills/:id/payment.json`. 204 on success.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawId - The raw `:id`.
   * @returns {Promise<void>}
   */
  @Delete('bills/:id/payment.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.NO_CONTENT)
  async undoBill(@CurrentOwner() owner: OwnerContext, @Param('id') rawId: string): Promise<void> {
    const id = parseId(rawId);
    const { billPayments } = await this.loader.services();

    await billPayments.undoBill(owner, id);
  }
}
