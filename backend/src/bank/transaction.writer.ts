import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { AccountTypeRegistry } from './account-types/account-type.registry.js';
import type { Account } from './entities/account.entity.js';
import { Reconciliation } from './entities/reconciliation.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { PaymentGeneratedQuery } from './payment-generated.query.js';
import { mapDeadlock, transactionCleared } from './reconciliation-conflicts.js';
import { shouldAutoUntick } from './reconciliation-eligibility.js';
import { assertNotArchived, lockAccount, lockStatement } from './reconciliation-guards.js';
import { ReconciliationQuery, type LockedTransaction } from './reconciliation.query.js';
import { PROVIDER_EXPENSE_TYPE, serializeTransaction, type TransactionResponse } from './transaction-response.js';
import { hasMinRole, OrgRole, orgRoleForbidden } from '../core/org-role.js';
import { ownerRole, type OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';

/** The validated fields of a transaction PATCH; an `undefined` field is left as stored. */
export interface TransactionEdit {
  date?: string;
  /** The parsed amount, in minor units of the account currency. */
  amount?: bigint;
  description?: string;
  notes?: string | null;
}

/**
 * The locked transaction PATCH and DELETE (lazy `BankModule`). One DB transaction takes the lock
 * order account row, then (for a date edit) the open statement row, then the transaction row, and
 * applies the lock matrix of `docs/agents/modules/bank/reconciliation.md` (*Lock matrix*): the amount and the date
 * of a cleared row (linked to a finished statement) are frozen, a ticked row moved out of its
 * statement's range is unticked, and a cleared row cannot be deleted. A request rejected by a
 * lock applies nothing.
 */
@Injectable()
export class TransactionWriter {
  private readonly transactionRepository: Repository<Transaction>;
  private readonly paymentGenerated: PaymentGeneratedQuery;
  private readonly query: ReconciliationQuery;
  private readonly registry: AccountTypeRegistry;

  /**
   * @param {Repository<Transaction>} transactionRepository - The transaction repository (its manager opens the write transaction).
   * @param {PaymentGeneratedQuery} paymentGenerated - The owner-scoped payment-generated lookup.
   * @param {ReconciliationQuery} query - The statement lookups and the row lock.
   * @param {AccountTypeRegistry} registry - The account type handlers.
   */
  constructor(
  @InjectRepository(Transaction) transactionRepository: Repository<Transaction>,
    paymentGenerated: PaymentGeneratedQuery,
    query: ReconciliationQuery,
    registry: AccountTypeRegistry,
  ) {
    this.transactionRepository = transactionRepository;
    this.paymentGenerated = paymentGenerated;
    this.query = query;
    this.registry = registry;
  }

  /**
   * Edits a transaction under the locks.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} transactionId - The transaction id.
   * @param {TransactionEdit} edit - The validated fields.
   * @returns {Promise<TransactionResponse>} The updated transaction, with its statement.
   * @throws {NotFoundException} The uniform 404 when not found in this owned account.
   * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED`, `TRANSACTION_CLEARED`, `CONCURRENT_UPDATE`.
   * @throws {ForbiddenException} The uniform 403 when an organization `user` edits a payment-generated transaction.
   */
  async update(owner: OwnerContext, accountId: number, transactionId: number, edit: TransactionEdit): Promise<TransactionResponse> {
    return mapDeadlock(() => this.transactionRepository.manager.transaction(async (manager) => {
      const { account, open } = await this.#lockUpTo(manager, owner, accountId, edit.date !== undefined);
      const locked = await this.#lockRow(manager, account.id, transactionId);
      const repository = manager.getRepository(Transaction);
      const transaction = await repository.findOneBy({ id: transactionId, accountId: account.id });

      if (!transaction) {
        throw ownerNotFound();
      }

      const paymentGenerated = await this.paymentGenerated.isPaymentGenerated(owner, transaction.id);

      assertMayEdit(owner, paymentGenerated);
      assertEditAllowed(locked, open, edit);
      applyEdit(account, transaction, edit);

      if (open && ticked(locked, open) && edit.date !== undefined && shouldAutoUntick(edit.date, open, account)) {
        transaction.reconciliationId = null;
      }

      const saved = await repository.save(transaction);

      return serializeTransaction(saved, account, paymentGenerated, await this.#statementOf(manager, saved));
    }));
  }

  /**
   * Hard-deletes a transaction under the locks.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The account id.
   * @param {number} transactionId - The transaction id.
   * @returns {Promise<void>}
   * @throws {NotFoundException} The uniform 404 when not found in this owned account.
   * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED`, `TRANSACTION_CLEARED`, `CONCURRENT_UPDATE`.
   */
  async delete(owner: OwnerContext, accountId: number, transactionId: number): Promise<void> {
    await mapDeadlock(() => this.transactionRepository.manager.transaction(async (manager) => {
      const { account, open } = await this.#lockUpTo(manager, owner, accountId, false);
      const locked = await this.#lockRow(manager, account.id, transactionId);

      if (cleared(locked, open)) {
        throw transactionCleared();
      }

      await manager.getRepository(Transaction).delete({ id: transactionId, accountId: account.id });
    }));
  }

  // The account row, then the open statement row (when asked), in the fixed lock order.
  async #lockUpTo(manager: EntityManager, owner: OwnerContext, accountId: number, withStatement: boolean) {
    const account = await lockAccount(manager, owner, accountId);

    if (!this.registry.get(account.type).carriesLedger) {
      throw ownerNotFound();
    }

    assertNotArchived(account);

    const open = await this.query.openStatement(account.id, manager);

    if (open && withStatement) {
      await lockStatement(manager, account.id, open.id);
    }

    return { account, open };
  }

  async #lockRow(manager: EntityManager, accountId: number, transactionId: number): Promise<LockedTransaction> {
    const [locked] = await this.query.lockTransactions(manager, accountId, [transactionId]);

    if (!locked) {
      throw ownerNotFound();
    }

    return locked;
  }

  // The account-scoped lookup: a statement of another account is never joined.
  async #statementOf(manager: EntityManager, transaction: Transaction): Promise<Reconciliation | null> {
    if (transaction.reconciliationId === null) {
      return null;
    }

    return manager.getRepository(Reconciliation).findOneBy({ id: transaction.reconciliationId, accountId: transaction.accountId });
  }
}

// A row linked to the open statement is ticked; a link to any other statement means a finished one.
function ticked(row: LockedTransaction, open: Reconciliation | null): boolean {
  return row.reconciliationId !== null && open !== null && row.reconciliationId === open.id;
}

function cleared(row: LockedTransaction, open: Reconciliation | null): boolean {
  return row.reconciliationId !== null && !ticked(row, open);
}

// Compares values, not strings: `"10"` and `"10.00"` parse to the same minor units.
function assertEditAllowed(row: LockedTransaction, open: Reconciliation | null, edit: TransactionEdit): void {
  const amountChanged = edit.amount !== undefined && edit.amount !== row.amount;
  const dateChanged = edit.date !== undefined && edit.date !== row.date;

  if (cleared(row, open) && (amountChanged || dateChanged)) {
    throw transactionCleared();
  }
}

// Fail-closed: every role below `admin` (known or not) may not edit a payment-generated
// transaction; `owner`, `admin` and the personal context may. The flag is the single
// owner-scoped EXISTS the update runs for every role (and returns in the response), so a bill
// payment of another owner or context never makes the transaction payment-generated.
function assertMayEdit(owner: OwnerContext, paymentGenerated: boolean): void {
  if (paymentGenerated && !hasMinRole(ownerRole(owner), OrgRole.ADMIN)) {
    throw orgRoleForbidden();
  }
}

function applyEdit(account: Account, transaction: Transaction, edit: TransactionEdit): void {
  if (edit.amount !== undefined) {
    transaction.amount = edit.amount;
    clearMarkOnPayment(account, transaction);
  }

  Object.assign(transaction, definedFields({ date: edit.date, description: edit.description, notes: edit.notes }));
}

/**
 * @param {Record<string, unknown>} fields - Candidate fields.
 * @returns {Record<string, unknown>} Only the fields that were sent (not `undefined`).
 */
function definedFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/**
 * A sent charge edited into a payment (positive amount) loses its hand-off mark, so a payment
 * is never marked; flipping it back yields an unsent charge. Other edits keep the mark.
 * @param {Account} account - The transaction's account.
 * @param {Transaction} transaction - The transaction, with its new amount.
 * @returns {void}
 */
function clearMarkOnPayment(account: Account, transaction: Transaction): void {
  if (account.type === PROVIDER_EXPENSE_TYPE && transaction.amount > 0n) {
    transaction.sentToAccountantAt = null;
  }
}
