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
import { buildPagination, LEDGER_PER_PAGE } from './pagination.js';
import {
  serializeLedger,
  serializeTransaction,
  type LedgerResponse,
  type TransactionResponse,
} from './transaction-response.js';
import { TransactionWriter } from './transaction.writer.js';

const AMOUNT_RULES = { nonZero: true };

/**
 * Transactions and the paginated ledger of an account (lazy `BankModule`).
 * Every method first resolves the account through the owner-scoped
 * `AccountService.findOwned`, then the transaction by `{ id, accountId }`, so
 * an account of another owner or context, a transaction of another account
 * and an unknown id all answer the same uniform 404. Transactions of an
 * archived account are read-only (409). The locked PATCH and DELETE (reconciliation locks,
 * payment-generated 403) live in {@link TransactionWriter}.
 */
@Injectable()
export class TransactionService {
  private readonly transactionRepository: Repository<Transaction>;
  private readonly accounts: AccountService;
  private readonly registry: AccountTypeRegistry;
  private readonly ledgerQuery: LedgerQuery;
  private readonly writer: TransactionWriter;

  /**
   * @param {Repository<Transaction>} transactionRepository - The transaction repository.
   * @param {AccountService} accounts - Owner-scoped account lookups.
   * @param {AccountTypeRegistry} registry - The account type handlers.
   * @param {LedgerQuery} ledgerQuery - The ledger SQL.
   * @param {TransactionWriter} writer - The locked PATCH and DELETE.
   */
  constructor(
    @InjectRepository(Transaction) transactionRepository: Repository<Transaction>,
      accounts: AccountService,
      registry: AccountTypeRegistry,
      ledgerQuery: LedgerQuery,
      writer: TransactionWriter,
  ) {
    this.transactionRepository = transactionRepository;
    this.accounts = accounts;
    this.registry = registry;
    this.ledgerQuery = ledgerQuery;
    this.writer = writer;
  }

  /**
   * Reads one page of the ledger (50 rows, newest first) with running
   * balances; the virtual opening row is on the last page only.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} page - The 1-based page (parsed by `parsePage`).
   * @returns {Promise<LedgerResponse>} The ledger envelope (empty past the last page).
   * @throws {NotFoundException} The uniform 404 when the account is not owned.
   */
  async ledger(owner: OwnerContext, accountId: number, page: number): Promise<LedgerResponse> {
    const account = await this.#ledgerAccount(owner, accountId);
    const pagination = buildPagination(page, LEDGER_PER_PAGE, await this.ledgerQuery.count(account.id));
    const lastReconciledDate = await this.ledgerQuery.lastReconciledDate(account.id);
    const rows = page > pagination.total_pages ? [] : await this.ledgerQuery.page(owner, account, page, LEDGER_PER_PAGE);
    const opening = page === pagination.total_pages ? await this.ledgerQuery.openingEffective(account) : null;

    return serializeLedger(account, rows, opening, pagination, lastReconciledDate);
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
      sentToAccountantAt: null,
    });

    // A just-created transaction is on no statement (even dated inside a finished period) and
    // cannot be referenced by a bill payment yet.
    return serializeTransaction(await this.transactionRepository.save(transaction), account, false, null);
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} transactionId - The transaction id.
   * @param {UpdateTransactionDto} dto - The validated body.
   * @returns {Promise<TransactionResponse>} The updated transaction.
   * @throws {NotFoundException} The uniform 404 when not found in this owned account.
   * @throws {ConflictException} 409 when the account is archived.
   * @throws {ForbiddenException} The uniform 403 when an organization `user` edits a
   *   payment-generated transaction.
   * @throws {BadRequestException} For an invalid amount in the account's currency.
   */
  async update(
    owner: OwnerContext,
    accountId: number,
    transactionId: number,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponse> {
    const account = await this.#ledgerAccount(owner, accountId);

    await this.#findTransaction(account, transactionId);

    const amount = dto.amount === undefined ? undefined : parseAmountInput('amount', dto.amount, account.currency, AMOUNT_RULES);

    return this.writer.update(owner, accountId, transactionId, {
      amount,
      date: dto.date,
      description: dto.description,
      notes: dto.notes,
    });
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
    await this.#ledgerAccount(owner, accountId);
    await this.writer.delete(owner, accountId, transactionId);
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
