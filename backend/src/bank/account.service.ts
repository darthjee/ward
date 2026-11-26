import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, type EntityManager } from 'typeorm';
import { AccountBalancesQuery } from './account-balances.query.js';
import { accountArchived, accountHasTransactions, mapNameClash } from './account-conflicts.js';
import { accountOwnerWhere, copyEditableFields, nestedObject, ownerColumns, presentFields } from './account-fields.js';
import { applyCurrencyChange, assertAnchorUnlocked, hasLockingStatement } from './account-reconciliation-guard.js';
import type { AccountResponse } from './account-response.js';
import { AccountScheduleValidator, type ScheduleCheck } from './account-schedule.validator.js';
import { AccountPresenter } from './account.presenter.js';
import { parseAmountInput } from './amount-input.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import type { AccountTypeHandler } from './account-types/account-type-handler.js';
import { AccountTypeRegistry } from './account-types/account-type.registry.js';
import { BANK_CONFIG, type BankConfig } from './bank.config.js';
import type { CreateAccountDto } from './dto/create-account.dto.js';
import type { UpdateAccountDto } from './dto/update-account.dto.js';
import { Account } from './entities/account.entity.js';
import { todayUtc } from './ledger-date.js';
import { isMysqlError, MYSQL_ROW_IS_REFERENCED } from './mysql-errors.js';
import { mapDeadlock } from './reconciliation-conflicts.js';
import { lockAccount } from './reconciliation-guards.js';
import { ReconciliationQuery } from './reconciliation.query.js';

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
  private readonly schedule: AccountScheduleValidator;
  private readonly reconciliation: ReconciliationQuery;
  private readonly presenter: AccountPresenter;

  /**
   * @param {Repository<Account>} accountRepository - The account repository.
   * @param {AccountTypeRegistry} registry - The account type handlers.
   * @param {AccountBalancesQuery} balances - Balance reads.
   * @param {BankConfig} config - The boot-validated bank config.
   * @param {AccountScheduleValidator} schedule - The owner-aware schedule-field check.
   * @param {ReconciliationQuery} reconciliation - The statement lookups (anchor and currency locks, detail fields).
   */
  constructor(
    @InjectRepository(Account) accountRepository: Repository<Account>,
      registry: AccountTypeRegistry,
      balances: AccountBalancesQuery,
    @Inject(BANK_CONFIG) config: BankConfig,
      schedule: AccountScheduleValidator,
      reconciliation: ReconciliationQuery,
  ) {
    this.accountRepository = accountRepository;
    this.registry = registry;
    this.balances = balances;
    this.config = config;
    this.schedule = schedule;
    this.reconciliation = reconciliation;
    this.presenter = new AccountPresenter(accountRepository, registry, balances, reconciliation);
  }

  /**
   * Lists the owner's accounts of one type, sorted by name, with every current
   * balance from one grouped query, `account_number` masked and the handlers'
   * list-only fields (e.g. a provider's `bills_summary`).
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

    return this.presenter.present(accounts, { mask: true, listExtras: true });
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The account id.
   * @returns {Promise<AccountResponse>} The account with its full number, current balance and the
   *   reconciliation fields (`last_reconciliation`, `open_reconciliation_id`; the detail only).
   * @throws {NotFoundException} The uniform 404 when not owned by `owner`.
   */
  async find(owner: OwnerContext, id: number): Promise<AccountResponse> {
    return this.presenter.presentOne(await this.findOwned(owner, id), { mask: false, detail: true });
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
   * @returns {Promise<AccountResponse>} The new account (`account_number` masked).
   * @throws {BadRequestException} For a type without a handler or an invalid amount.
   * @throws {UnprocessableEntityException} 422 on an invalid default paying account.
   * @throws {ConflictException} 409 on an active-name clash.
   */
  async create(owner: OwnerContext, dto: CreateAccountDto): Promise<AccountResponse> {
    const handler = this.registry.get(dto.type ?? DEFAULT_ACCOUNT_TYPE);
    this.registry.assertNoForeignNested(dto, handler.type);

    const currency = dto.currency ?? this.config.defaultCurrency;
    const nested = nestedObject(dto, handler.type);
    const prepared = handler.validateCreate(nested, { currency });
    await this.#validateSchedule(owner, handler, { nested, prepared, currency, currencyChanged: false });
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

    return this.presenter.presentOne(await this.#saveWithDetails(account, handler, prepared), { mask: true });
  }

  /**
   * Edits an account in one DB transaction that starts with the account row lock. On an archived
   * account only `name` is accepted (checked before any nested validation). The currency is locked
   * once the account has transactions or a statement, and `opening_date` / `opening_balance` once
   * it has a statement (open or finished). A type's nested object (e.g. `debt`) is merged onto the
   * stored details (stored amounts rescaled when the currency changes).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The account id.
   * @param {UpdateAccountDto} dto - The validated body.
   * @returns {Promise<AccountResponse>} The updated account (`account_number` masked).
   * @throws {NotFoundException} The uniform 404 when not owned by `owner`.
   * @throws {ConflictException} 409 on an archived edit, a locked currency, a locked opening anchor,
   *   a name clash or a deadlock.
   */
  async update(owner: OwnerContext, id: number, dto: UpdateAccountDto): Promise<AccountResponse> {
    const saved = await mapNameClash(() => mapDeadlock(() =>
      this.accountRepository.manager.transaction(async (manager) => this.#updateLocked(manager, owner, id, dto))));

    return this.presenter.presentOne(saved, { mask: true });
  }

  /**
   * Archives an account (idempotent).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The account id.
   * @returns {Promise<AccountResponse>} The archived account (`account_number` masked).
   * @throws {NotFoundException} The uniform 404 when not owned by `owner`.
   */
  async archive(owner: OwnerContext, id: number): Promise<AccountResponse> {
    const account = await this.findOwned(owner, id);

    if (!account.archivedAt) {
      account.archivedAt = new Date();
      await this.accountRepository.save(account);
    }

    return this.presenter.presentOne(account, { mask: true });
  }

  /**
   * Unarchives an account (idempotent).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The account id.
   * @returns {Promise<AccountResponse>} The active account (`account_number` masked).
   * @throws {NotFoundException} The uniform 404 when not owned by `owner`.
   * @throws {ConflictException} 409 when an active account already has its name.
   */
  async unarchive(owner: OwnerContext, id: number): Promise<AccountResponse> {
    const account = await this.findOwned(owner, id);

    if (account.archivedAt) {
      account.archivedAt = null;
      await mapNameClash(() => this.accountRepository.save(account));
    }

    return this.presenter.presentOne(account, { mask: true });
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

  async #updateLocked(manager: EntityManager, owner: OwnerContext, id: number, dto: UpdateAccountDto): Promise<Account> {
    const account = await lockAccount(manager, owner, id);
    const handler = this.registry.get(account.type);
    this.registry.assertNoForeignNested(dto, handler.type);

    if (account.archivedAt && presentFields(dto).some((field) => field !== ARCHIVED_EDITABLE_FIELD)) {
      throw accountArchived();
    }

    const previousCurrency = account.currency;
    const hasStatement = await hasLockingStatement(this.reconciliation, manager, account, dto);
    await applyCurrencyChange(account, dto, hasStatement, this.balances);
    assertAnchorUnlocked(account, dto, hasStatement);

    const stored = (await this.registry.loadDetails([account], manager)).get(account.id);
    const nested = nestedObject(dto, handler.type);
    const { currency } = account;
    const prepared = handler.validateUpdate(nested, stored, { currency, previousCurrency });
    await this.#validateSchedule(owner, handler, { nested, prepared, currency, currencyChanged: currency !== previousCurrency });

    copyEditableFields(account, dto);

    if (dto.opening_balance !== undefined) {
      account.openingBalance = parseAmountInput('opening_balance', dto.opening_balance, account.currency);
    }

    handler.validateAccount(account);

    const saved = await manager.getRepository(Account).save(account);
    await handler.saveDetails(saved, prepared, manager);

    return saved;
  }

  async #validateSchedule(owner: OwnerContext, handler: AccountTypeHandler, check: ScheduleCheck): Promise<void> {
    if (handler.hasSchedule) {
      await this.schedule.validate(owner, check);
    }
  }

  async #saveWithDetails(account: Account, handler: AccountTypeHandler, prepared: unknown): Promise<Account> {
    handler.validateAccount(account);
    return mapNameClash(() =>
      this.accountRepository.manager.transaction(async (manager) => {
        const saved = await manager.getRepository(Account).save(account);
        await handler.saveDetails(saved, prepared, manager);
        return saved;
      }),
    );
  }
}
