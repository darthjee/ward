import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { accountArchived } from './account-conflicts.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import { AccountTypeRegistry } from './account-types/account-type.registry.js';
import { AccountService } from './account.service.js';
import { parseAmountInput } from './amount-input.js';
import type { CreateTransactionDto } from './dto/create-transaction.dto.js';
import type { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import type { Account } from './entities/account.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { LedgerQuery } from './ledger.query.js';
import { buildPagination, LEDGER_PER_PAGE, parsePage } from './pagination.js';
import {
  serializeLedger,
  serializeTransaction,
  type LedgerResponse,
  type TransactionResponse,
} from './transaction-response.js';

const AMOUNT_RULES = { nonZero: true };

/**
 * Transactions and the paginated ledger of an account (lazy `BankModule`).
 * Every method first resolves the account through the owner-scoped
 * `AccountService.findOwned`, then the transaction by `{ id, accountId }`, so
 * an account of another owner or context, a transaction of another account
 * and an unknown id all answer the same uniform 404. Transactions of an
 * archived account are read-only (409).
 */
@Injectable()
export class TransactionService {
  private readonly transactionRepository: Repository<Transaction>;
  private readonly accounts: AccountService;
  private readonly registry: AccountTypeRegistry;
  private readonly ledgerQuery: LedgerQuery;

  /**
   * @param {Repository<Transaction>} transactionRepository - The transaction repository.
   * @param {AccountService} accounts - Owner-scoped account lookups.
   * @param {AccountTypeRegistry} registry - The account type handlers.
   * @param {LedgerQuery} ledgerQuery - The ledger SQL.
   */
  constructor(
    @InjectRepository(Transaction) transactionRepository: Repository<Transaction>,
      accounts: AccountService,
      registry: AccountTypeRegistry,
      ledgerQuery: LedgerQuery,
  ) {
    this.transactionRepository = transactionRepository;
    this.accounts = accounts;
    this.registry = registry;
    this.ledgerQuery = ledgerQuery;
  }

  /**
   * Reads one page of the ledger (50 rows, newest first) with running
   * balances; the virtual opening row is on the last page only.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {unknown} rawPage - The raw `page` query value.
   * @returns {Promise<LedgerResponse>} The ledger envelope.
   * @throws {BadRequestException} For a non-numeric or `< 1` page.
   * @throws {NotFoundException} The uniform 404 when the account is not owned.
   */
  async ledger(owner: OwnerContext, accountId: number, rawPage: unknown): Promise<LedgerResponse> {
    const page = parsePage(rawPage);
    const account = await this.#ledgerAccount(owner, accountId);
    const pagination = buildPagination(page, LEDGER_PER_PAGE, await this.ledgerQuery.count(account.id));
    const rows = page > pagination.total_pages ? [] : await this.ledgerQuery.page(account, page, LEDGER_PER_PAGE);
    const opening = page === pagination.total_pages ? await this.ledgerQuery.openingEffective(account) : null;

    return serializeLedger(account, rows, opening, pagination);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {CreateTransactionDto} dto - The validated body.
   * @returns {Promise<TransactionResponse>} The new transaction.
   * @throws {NotFoundException} The uniform 404 when the account is not owned.
   * @throws {ConflictException} 409 when the account is archived.
   * @throws {BadRequestException} For an invalid amount in the account's currency.
   */
  async create(owner: OwnerContext, accountId: number, dto: CreateTransactionDto): Promise<TransactionResponse> {
    const account = await this.#writableAccount(owner, accountId);
    const transaction = this.transactionRepository.create({
      accountId: account.id,
      date: dto.date,
      amount: parseAmountInput('amount', dto.amount, account.currency, AMOUNT_RULES),
      description: dto.description,
      notes: dto.notes ?? null,
    });

    return serializeTransaction(await this.transactionRepository.save(transaction), account.currency);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} transactionId - The transaction id.
   * @param {UpdateTransactionDto} dto - The validated body.
   * @returns {Promise<TransactionResponse>} The updated transaction.
   * @throws {NotFoundException} The uniform 404 when not found in this owned account.
   * @throws {ConflictException} 409 when the account is archived.
   * @throws {BadRequestException} For an invalid amount in the account's currency.
   */
  async update(
    owner: OwnerContext,
    accountId: number,
    transactionId: number,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponse> {
    const account = await this.#writableAccount(owner, accountId);
    const transaction = await this.#findTransaction(account, transactionId);

    if (dto.amount !== undefined) {
      transaction.amount = parseAmountInput('amount', dto.amount, account.currency, AMOUNT_RULES);
    }

    Object.assign(transaction, definedFields({ date: dto.date, description: dto.description, notes: dto.notes }));

    return serializeTransaction(await this.transactionRepository.save(transaction), account.currency);
  }

  /**
   * Hard-deletes a transaction.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} transactionId - The transaction id.
   * @returns {Promise<void>}
   * @throws {NotFoundException} The uniform 404 when not found in this owned account.
   * @throws {ConflictException} 409 when the account is archived.
   */
  async delete(owner: OwnerContext, accountId: number, transactionId: number): Promise<void> {
    const account = await this.#writableAccount(owner, accountId);
    const transaction = await this.#findTransaction(account, transactionId);

    await this.transactionRepository.delete({ id: transaction.id, accountId: account.id });
  }

  async #ledgerAccount(owner: OwnerContext, accountId: number): Promise<Account> {
    const account = await this.accounts.findOwned(owner, accountId);

    if (!this.registry.get(account.type).carriesLedger) {
      throw ownerNotFound();
    }

    return account;
  }

  async #writableAccount(owner: OwnerContext, accountId: number): Promise<Account> {
    const account = await this.#ledgerAccount(owner, accountId);

    if (account.archivedAt) {
      throw accountArchived();
    }

    return account;
  }

  async #findTransaction(account: Account, transactionId: number): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOneBy({ id: transactionId, accountId: account.id });

    if (!transaction) {
      throw ownerNotFound();
    }

    return transaction;
  }
}

/**
 * @param {Record<string, unknown>} fields - Candidate fields.
 * @returns {Record<string, unknown>} Only the fields that were sent (not `undefined`).
 */
function definedFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}
