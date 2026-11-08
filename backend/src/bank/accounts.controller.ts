import { Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, ValidationPipe } from '@nestjs/common';
import type { AccountResponse } from './account-response.js';
import { BankModuleLoader } from './bank-module.loader.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentOwner } from '../core/current-owner.decorator.js';
import type { OwnerContext } from '../core/owner-context.js';
import { OwnerScopedController } from '../core/owner-scoped.decorator.js';
import { parseId } from '../core/parse-id.js';
import { StrictBody } from '../core/strict-validation.pipe.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';

const QUERY_PIPE = new ValidationPipe({ whitelist: true, transform: true });

/**
 * Account routes, mounted under `bank/…` and `orgs/:orgId/bank/…` (generic
 * for every account type). Thin: parses the ids (a malformed id answers the
 * uniform 404, never 400), loads the lazy `BankModule` and delegates to its
 * `AccountService`. The owner always comes from `@CurrentOwner()`; bodies only
 * through `@StrictBody()`. GETs are `user-scoped`, writes `never`. Bodies are
 * never logged.
 */
@OwnerScopedController('bank')
export class AccountsController {
  private readonly loader: BankModuleLoader;

  /**
   * @param {BankModuleLoader} loader - Loads the lazy `BankModule`.
   */
  constructor(loader: BankModuleLoader) {
    this.loader = loader;
  }

  /**
   * `GET <base>/accounts.json?type=regular&archived=false`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {ListAccountsQueryDto} query - `type` and `archived`.
   * @returns {Promise<AccountResponse[]>} The accounts, sorted by name, numbers masked.
   */
  @Get('accounts.json')
  async list(
    @CurrentOwner() owner: OwnerContext,
      @Query(QUERY_PIPE) query: ListAccountsQueryDto,
  ): Promise<AccountResponse[]> {
    const { accounts } = await this.loader.services();

    return accounts.list(owner, { type: query.type, archived: query.archived === 'true' });
  }

  /**
   * `POST <base>/accounts.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {CreateAccountDto} dto - The account fields.
   * @returns {Promise<AccountResponse>} The created account.
   */
  @Post('accounts.json')
  @CachePolicy(CacheClass.Never)
  async create(
    @CurrentOwner() owner: OwnerContext,
      @StrictBody() dto: CreateAccountDto,
  ): Promise<AccountResponse> {
    const { accounts } = await this.loader.services();

    return accounts.create(owner, dto);
  }

  /**
   * `GET <base>/accounts/:accountId.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @returns {Promise<AccountResponse>} The account, full number and current balance.
   */
  @Get('accounts/:accountId.json')
  async show(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
  ): Promise<AccountResponse> {
    const accountId = parseId(rawAccountId);
    const { accounts } = await this.loader.services();

    return accounts.find(owner, accountId);
  }

  /**
   * `PATCH <base>/accounts/:accountId.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @param {UpdateAccountDto} dto - The fields to change.
   * @returns {Promise<AccountResponse>} The updated account.
   */
  @Patch('accounts/:accountId.json')
  @CachePolicy(CacheClass.Never)
  async update(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
      @StrictBody() dto: UpdateAccountDto,
  ): Promise<AccountResponse> {
    const accountId = parseId(rawAccountId);
    const { accounts } = await this.loader.services();

    return accounts.update(owner, accountId, dto);
  }

  /**
   * `DELETE <base>/accounts/:accountId.json`. 204 on success.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @returns {Promise<void>}
   */
  @Delete('accounts/:accountId.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
  ): Promise<void> {
    const accountId = parseId(rawAccountId);
    const { accounts } = await this.loader.services();

    await accounts.delete(owner, accountId);
  }

  /**
   * `POST <base>/accounts/:accountId/archive.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @returns {Promise<AccountResponse>} The archived account.
   */
  @Post('accounts/:accountId/archive.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.OK)
  async archive(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
  ): Promise<AccountResponse> {
    const accountId = parseId(rawAccountId);
    const { accounts } = await this.loader.services();

    return accounts.archive(owner, accountId);
  }

  /**
   * `POST <base>/accounts/:accountId/unarchive.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {string} rawAccountId - The raw `:accountId`.
   * @returns {Promise<AccountResponse>} The active account.
   */
  @Post('accounts/:accountId/unarchive.json')
  @CachePolicy(CacheClass.Never)
  @HttpCode(HttpStatus.OK)
  async unarchive(
    @CurrentOwner() owner: OwnerContext,
      @Param('accountId') rawAccountId: string,
  ): Promise<AccountResponse> {
    const accountId = parseId(rawAccountId);
    const { accounts } = await this.loader.services();

    return accounts.unarchive(owner, accountId);
  }
}
