import { Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { BankModuleLoader } from './bank-module.loader.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentOwner } from '../core/current-owner.decorator.js';
import type { OwnerContext } from '../core/owner-context.js';
import { OwnerScopedController } from '../core/owner-scoped.decorator.js';
import { parseId } from '../core/parse-id.js';
import { StrictBody } from '../core/strict-validation.pipe.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import { parsePage } from './pagination.js';
import type { LedgerResponse, TransactionResponse } from './transaction-response.js';

/**
 * Transaction and ledger routes, mounted under `bank/…` and
 * `orgs/:orgId/bank/…`. Thin: parses the ids (malformed → uniform 404) and
 * the page (invalid → 400), loads the lazy `BankModule` and delegates to its
 * `TransactionService`. The ledger GET is `user-scoped`, writes `never`.
 * Bodies only through `@StrictBody()`, never logged.
 */
@OwnerScopedController('bank')
export class TransactionsController {
  private readonly loader: BankModuleLoader;

  /**
   * @param {BankModuleLoader} loader - Loads the lazy `BankModule`.
   */
  constructor(loader: BankModuleLoader) {
    this.loader = loader;
  }

  /**
   * `GET <base>/accounts/:accountId/transactions.json?page=N`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {unknown} rawPage - The raw `page` query value.
   * @returns {Promise<LedgerResponse>} The ledger envelope.
   */
  @Get('accounts/:accountId/transactions.json')
  async ledger(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Query('page') rawPage: unknown,
  ): Promise<LedgerResponse> {
    const accountId = parseId(rawAccountId);
    const page = parsePage(rawPage);
    const { transactions } = await this.loader.services();

    return transactions.ledger(owner, accountId, page);
  }

  /**
   * `POST <base>/accounts/:accountId/transactions.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {CreateTransactionDto} dto - The transaction fields.
   * @returns {Promise<TransactionResponse>} The created transaction.
   */
  @Post('accounts/:accountId/transactions.json')
  @CachePolicy(CacheClass.Never)
  async create(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @StrictBody() dto: CreateTransactionDto,
  ): Promise<TransactionResponse> {
    const accountId = parseId(rawAccountId);
    const { transactions } = await this.loader.services();

    return transactions.create(owner, accountId, dto);
  }

  /**
   * `PATCH <base>/accounts/:accountId/transactions/:transactionId.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {string} rawTransactionId - The raw `:transactionId`.
   * @param {UpdateTransactionDto} dto - The fields to change.
   * @returns {Promise<TransactionResponse>} The updated transaction.
   */
  @Patch('accounts/:accountId/transactions/:transactionId.json')
  @CachePolicy(CacheClass.Never)
  async update(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Param('transactionId') rawTransactionId: string,
      @StrictBody() dto: UpdateTransactionDto,
  ): Promise<TransactionResponse> {
    const accountId = parseId(rawAccountId);
    const transactionId = parseId(rawTransactionId);
    const { transactions } = await this.loader.services();

    return transactions.update(owner, accountId, transactionId, dto);
  }

  /**
   * `DELETE <base>/accounts/:accountId/transactions/:transactionId.json`. 204 on success.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {string} rawTransactionId - The raw `:transactionId`.
   * @returns {Promise<void>}
   */
  @Delete('accounts/:accountId/transactions/:transactionId.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @Param('transactionId') rawTransactionId: string,
  ): Promise<void> {
    const accountId = parseId(rawAccountId);
    const transactionId = parseId(rawTransactionId);
    const { transactions } = await this.loader.services();

    await transactions.delete(owner, accountId, transactionId);
  }
}
