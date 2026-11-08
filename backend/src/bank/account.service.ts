import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AccountBalancesQuery } from './account-balances.query.js';
import { accountArchived, accountHasTransactions, currencyLocked, mapNameClash } from './account-conflicts.js';
import { accountOwnerWhere, copyEditableFields, nestedObject, ownerColumns, presentFields } from './account-fields.js';
import { serializeAccount, type AccountResponse } from './account-response.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import type { AccountTypeHandler } from './account-types/account-type-handler.js';
import { AccountTypeRegistry } from './account-types/account-type.registry.js';
import { convertAmountInput, parseAmountInput } from './amount-input.js';
import { BANK_CONFIG, type BankConfig } from './bank.config.js';
import type { CreateAccountDto } from './dto/create-account.dto.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';
import { Account } from './entities/account.entity.js';
import { todayUtc } from './ledger-date.js';
import { isMysqlError, MYSQL_ROW_IS_REFERENCED } from './mysql-errors.js';

// The account type used when a request names none.
const DEFAULT_ACCOUNT_TYPE = 'regular';

// The only field an archived account accepts.
const ARCHIVED_EDITABLE_FIELD = 'name';

/** Options of {@link AccountService.list}. */
export interface ListAccountsOptions {
  /** Account type to list (default `regular`). */
  type?: string;
  /** Also list archived accounts (default `false`). */
  archived?: boolean;
}

/**
 * Generic account logic for every account type (lazy `BankModule`). Every
 * query is scoped with `ownerWhere(owner)`, so an id of another owner or of
 * the other context is simply not found (the uniform 404). Type-specific
 * behaviour goes through the {@link AccountTypeRegistry}; this service never
 * names a specific type apart from the `regular` default.
 */
@Injectable()
export class AccountService {
  private readonly accountRepository: Repository<Account>;
  private readonly registry: AccountTypeRegistry;
  private readonly balances: AccountBalancesQuery;
  private readonly config: BankConfig;

  /**
   * @param {Repository<Account>} accountRepository - The account repository.
   * @param {AccountTypeRegistry} registry - The account type handlers.
   * @param {AccountBalancesQuery} balances - Balance reads.
   * @param {BankConfig} config - The boot-validated bank config.
   */
  constructor(
    @InjectRepository(Account) accountRepository: Repository<Account>,
      registry: AccountTypeRegistry,
      balances: AccountBalancesQuery,
    @Inject(BANK_CONFIG) config: BankConfig,
  ) {
    this.accountRepository = accountRepository;
    this.registry = registry;
    this.balances = balances;
    this.config = config;
  }

  /**
   * Lists the owner's accounts of one type, sorted by name, with every current
   * balance from one grouped query and `account_number` masked.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {ListAccountsOptions} options - Type and archived filter.
   * @returns {Promise<AccountResponse[]>} The accounts.
   * @throws {BadRequestException} For a type without a handler.
   */
  async list(owner: OwnerContext, options: ListAccountsOptions = {}): Promise<AccountResponse[]> {
    const handler = this.registry.get(options.type ?? DEFAULT_ACCOUNT_TYPE);
    const accounts = await this.accountRepository.find({
      where: { ...accountOwnerWhere(owner), type: handler.type, ...(options.archived ? {} : { archivedAt: IsNull() }) },
      order: { name: 'ASC', id: 'ASC' },
    });

    return this.#present(accounts, true);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The account id.
   * @returns {Promise<AccountResponse>} The account with its full number and current balance.
   * @throws {NotFoundException} The uniform 404 when not owned by `owner`.
   */
  async find(owner: OwnerContext, id: number): Promise<AccountResponse> {
    return this.#presentOne(await this.findOwned(owner, id));
  }

  /**
   * Loads an account owned by `owner` (also used by the transaction service).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The account id.
   * @returns {Promise<Account>} The account entity.
   * @throws {NotFoundException} The uniform 404 when not owned by `owner`.
   */
  async findOwned(owner: OwnerContext, id: number): Promise<Account> {
    const account = await this.accountRepository.findOneBy({ ...accountOwnerWhere(owner), id });

    if (!account) {
      throw ownerNotFound();
    }

    return account;
  }

  /**
   * Creates an account owned by `owner` (owner taken from the route only).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {CreateAccountDto} dto - The validated body.
   * @returns {Promise<AccountResponse>} The new account.
   * @throws {BadRequestException} For a type without a handler or an invalid amount.
   * @throws {ConflictException} 409 on an active-name clash.
   */
  async create(owner: OwnerContext, dto: CreateAccountDto): Promise<AccountResponse> {
    const handler = this.registry.get(dto.type ?? DEFAULT_ACCOUNT_TYPE);
    const nested = nestedObject(dto, handler.type);
    handler.validateCreate(nested);

    const currency = dto.currency ?? this.config.defaultCurrency;
    const account = this.accountRepository.create({
      ...ownerColumns(owner),
      type: handler.type,
      name: dto.name,
      bankName: dto.bank_name ?? null,
      branch: dto.branch ?? null,
      accountNumber: dto.account_number ?? null,
      currency,
      openingDate: dto.opening_date ?? todayUtc(new Date()),
      openingBalance: parseAmountInput('opening_balance', dto.opening_balance ?? '0', currency),
      archivedAt: null,
      notes: dto.notes ?? null,
    });

    return this.#presentOne(await this.#saveWithDetails(account, handler, nested));
  }

  /**
   * Edits an account. On an archived account only `name` is accepted; the
   * currency is locked once the account has transactions.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The account id.
   * @param {UpdateAccountDto} dto - The validated body.
   * @returns {Promise<AccountResponse>} The updated account.
   * @throws {NotFoundException} The uniform 404 when not owned by `owner`.
   * @throws {ConflictException} 409 on an archived edit, a locked currency or a name clash.
   */
  async update(owner: OwnerContext, id: number, dto: UpdateAccountDto): Promise<AccountResponse> {
    const account = await this.findOwned(owner, id);
    const handler = this.registry.get(account.type);
    const nested = nestedObject(dto, handler.type);
    handler.validateUpdate(nested);

    if (account.archivedAt && presentFields(dto).some((field) => field !== ARCHIVED_EDITABLE_FIELD)) {
      throw accountArchived();
    }

    await this.#applyCurrency(account, dto);

    copyEditableFields(account, dto);

    if (dto.opening_balance !== undefined) {
      account.openingBalance = parseAmountInput('opening_balance', dto.opening_balance, account.currency);
    }

    return this.#presentOne(await this.#saveWithDetails(account, handler, nested));
  }

  /**
   * Archives an account (idempotent).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The account id.
   * @returns {Promise<AccountResponse>} The archived account.
   * @throws {NotFoundException} The uniform 404 when not owned by `owner`.
   */
  async archive(owner: OwnerContext, id: number): Promise<AccountResponse> {
    const account = await this.findOwned(owner, id);

    if (!account.archivedAt) {
      account.archivedAt = new Date();
      await this.accountRepository.save(account);
    }

    return this.#presentOne(account);
  }

  /**
   * Unarchives an account (idempotent).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The account id.
   * @returns {Promise<AccountResponse>} The active account.
   * @throws {NotFoundException} The uniform 404 when not owned by `owner`.
   * @throws {ConflictException} 409 when an active account already has its name.
   */
  async unarchive(owner: OwnerContext, id: number): Promise<AccountResponse> {
    const account = await this.findOwned(owner, id);

    if (account.archivedAt) {
      account.archivedAt = null;
      await mapNameClash(() => this.accountRepository.save(account));
    }

    return this.#presentOne(account);
  }

  /**
   * Hard-deletes an account without transactions (the opening anchor does
   * not count). The FK `ON DELETE RESTRICT` covers the race with a concurrent
   * transaction create.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The account id.
   * @returns {Promise<void>}
   * @throws {NotFoundException} The uniform 404 when not owned by `owner`.
   * @throws {ConflictException} 409 when the account has transactions.
   */
  async delete(owner: OwnerContext, id: number): Promise<void> {
    const account = await this.findOwned(owner, id);

    if (await this.balances.hasTransactions(account.id)) {
      throw accountHasTransactions();
    }

    try {
      await this.accountRepository.delete({ id: account.id });
    } catch (error) {
      if (isMysqlError(error, MYSQL_ROW_IS_REFERENCED)) {
        throw accountHasTransactions();
      }

      throw error;
    }
  }

  async #applyCurrency(account: Account, dto: UpdateAccountDto): Promise<void> {
    if (dto.currency === undefined || dto.currency === account.currency) {
      return;
    }

    if (await this.balances.hasTransactions(account.id)) {
      throw currencyLocked();
    }

    if (dto.opening_balance === undefined) {
      account.openingBalance = convertAmountInput('opening_balance', account.openingBalance, account.currency, dto.currency);
    }

    account.currency = dto.currency;
  }

  async #saveWithDetails(account: Account, handler: AccountTypeHandler, nested: unknown): Promise<Account> {
    return mapNameClash(() =>
      this.accountRepository.manager.transaction(async (manager) => {
        const saved = await manager.getRepository(Account).save(account);
        await handler.saveDetails(saved, nested, manager);
        return saved;
      }),
    );
  }

  async #presentOne(account: Account): Promise<AccountResponse> {
    const [response] = await this.#present([account], false);

    return response;
  }

  async #present(accounts: Account[], mask: boolean): Promise<AccountResponse[]> {
    const balances = await this.balances.currentBalances(accounts);
    const details = await this.#loadDetails(accounts);

    return accounts.map((account) =>
      serializeAccount(account, {
        balance: balances.get(account.id) ?? account.openingBalance,
        mask,
        nested: this.registry.get(account.type).serialize(details.get(account.id)),
      }),
    );
  }

  async #loadDetails(accounts: Account[]): Promise<Map<number, unknown>> {
    const idsByType = new Map<string, number[]>();

    for (const account of accounts) {
      idsByType.set(account.type, [...(idsByType.get(account.type) ?? []), account.id]);
    }

    const details = new Map<number, unknown>();

    for (const [type, ids] of idsByType) {
      const loaded = await this.registry.get(type).loadDetails(ids, this.accountRepository.manager);
      loaded.forEach((value, id) => details.set(id, value));
    }

    return details;
  }
}
