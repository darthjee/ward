import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { accountArchived } from './account-conflicts.js';
import { accountOwnerWhere } from './account-fields.js';
import { parseAmountInput } from './amount-input.js';
import { Account } from './entities/account.entity.js';
import { Reconciliation } from './entities/reconciliation.entity.js';
import { reconciliationFinished, reconciliationOutOfOrder } from './reconciliation-conflicts.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';

// The locks and the account-dependent checks shared by every reconciliation write, in the fixed
// order account row -> statement row -> transaction rows (see
// `docs/agents/modules/bank/reconciliation.md`, *Concurrency*, and `docs/agents/backend/routes/bank.md`, *Reconciliation check order*).
// Every message is fixed static text: it never carries a balance, date, id or count.

/**
 * Re-reads the owner's account `FOR UPDATE`: the first lock of every write.
 * @param {EntityManager} manager - The write transaction's manager.
 * @param {OwnerContext} owner - The resolved owner.
 * @param {number} accountId - The account id.
 * @returns {Promise<Account>} The locked account.
 * @throws {NotFoundException} The uniform 404 when the account is not owned by `owner`.
 */
export async function lockAccount(manager: EntityManager, owner: OwnerContext, accountId: number): Promise<Account> {
  const account = await manager.getRepository(Account).findOne({
    where: { ...accountOwnerWhere(owner), id: accountId },
    lock: { mode: 'pessimistic_write' },
  });

  if (!account) {
    throw ownerNotFound();
  }

  return account;
}

/**
 * Reads the statement of the account `FOR UPDATE`: the second lock of a write (after the account).
 * @param {EntityManager} manager - The write transaction's manager.
 * @param {number} accountId - The (already locked) account id.
 * @param {number} statementId - The statement id.
 * @returns {Promise<Reconciliation>} The locked statement.
 * @throws {NotFoundException} The uniform 404 when the account has no such statement.
 */
export async function lockStatement(manager: EntityManager, accountId: number, statementId: number): Promise<Reconciliation> {
  const statement = await manager.getRepository(Reconciliation).findOne({
    where: { id: statementId, accountId },
    lock: { mode: 'pessimistic_write' },
  });

  if (!statement) {
    throw ownerNotFound();
  }

  return statement;
}

/**
 * @param {string} value - The submitted `statement_balance` decimal string.
 * @param {Account} account - The account (its currency applies).
 * @returns {bigint} The balance in minor units: signed, zero allowed, at most 10^13 in absolute value.
 * @throws {BadRequestException} 400 for a malformed balance, too many decimals or one beyond the bound.
 */
export function parseStatementBalance(value: string, account: Account): bigint {
  return parseAmountInput('statement_balance', value, account.currency);
}

/**
 * @param {string} date - The submitted `statement_date` (`YYYY-MM-DD`).
 * @param {Account} account - The account.
 * @returns {void}
 * @throws {BadRequestException} 400 when the date is before the account's opening date.
 */
export function assertNotBeforeOpening(date: string, account: Account): void {
  if (date < account.openingDate) {
    throw new BadRequestException('statement_date must not be before the account opening date');
  }
}

/**
 * @param {Account} account - The account.
 * @returns {void}
 * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED` when the account is archived.
 */
export function assertNotArchived(account: Account): void {
  if (account.archivedAt) {
    throw accountArchived();
  }
}

/**
 * @param {Reconciliation} statement - The statement.
 * @returns {void}
 * @throws {ConflictException} 409 `RECONCILIATION_FINISHED` when the statement is finished.
 */
export function assertOpen(statement: Reconciliation): void {
  if (statement.reconciledAt !== null) {
    throw reconciliationFinished();
  }
}

/**
 * Chronology: a statement date must be strictly after the latest finished statement's date.
 * @param {string} date - The (new) statement date.
 * @param {Reconciliation | null} latestFinished - The account's latest finished statement.
 * @returns {void}
 * @throws {ConflictException} 409 `RECONCILIATION_OUT_OF_ORDER` otherwise.
 */
export function assertAfterLatestFinished(date: string, latestFinished: Reconciliation | null): void {
  if (latestFinished && date <= latestFinished.statementDate) {
    throw reconciliationOutOfOrder();
  }
}
