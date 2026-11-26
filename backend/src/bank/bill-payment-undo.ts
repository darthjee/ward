import type { Repository } from 'typeorm';
import { accountArchived } from './account-conflicts.js';
import type { BillPaymentWriter } from './bill-payment.writer.js';
import { ownerNotFound } from '../core/parse-id.js';
import type { Account } from './entities/account.entity.js';
import type { BillPayment } from './entities/bill-payment.entity.js';

/**
 * The archived rules of an undo (checks 3-5 of `docs/agents/modules/bank/bills.md`). Run first
 * on plain reads for the public check order, and again inside the write transaction on the locked
 * account rows, so an archive cannot race the undo.
 * @param {BillPayment} payment - The occurrence's payment row.
 * @param {Account} source - The source (debt / provider) account.
 * @param {Account | null} paying - The paying account of a paid row, if any.
 * @returns {void}
 * @throws {NotFoundException} 404 for a skip on an archived source.
 * @throws {ConflictException} 409 when a paid row's source or paying account is archived.
 */
export function assertUndoable(payment: BillPayment, source: Account, paying: Account | null): void {
  if (payment.status === 'skipped' && source.archivedAt) {
    throw ownerNotFound();
  }

  if (payment.status === 'paid' && (source.archivedAt || paying?.archivedAt)) {
    throw accountArchived();
  }
}

/**
 * The shared undo checks 3-6 of `docs/agents/modules/bank/bills.md`: no row
 * and a skip on an archived source answer 404; a paid row with an archived
 * source or paying account answers 409 `ACCOUNT_ARCHIVED`; otherwise the row
 * and its transactions are removed (the writer then answers 409
 * `TRANSACTION_CLEARED` when one of them is cleared by a finished reconciliation).
 * @param {BillPaymentWriter} writer - The atomic payment writes.
 * @param {Repository<Account>} accounts - Reads the paying account.
 * @param {Account} source - The source (debt / provider) account.
 * @param {BillPayment | null} payment - The occurrence's payment row, if any.
 * @returns {Promise<void>}
 * @throws {NotFoundException} 404 without a row, or for a skip on an archived source.
 * @throws {ConflictException} 409 when a paid row's source or paying account is archived, or a
 *   generated transaction is cleared.
 */
export async function undoPayment(
  writer: BillPaymentWriter,
  accounts: Repository<Account>,
  source: Account,
  payment: BillPayment | null,
): Promise<void> {
  if (!payment) {
    throw ownerNotFound();
  }

  assertUndoable(payment, source, await payingAccount(accounts, payment, source));

  await writer.remove(payment);
}

// A paid row reads its paying account unless the source already decides the answer.
async function payingAccount(accounts: Repository<Account>, payment: BillPayment, source: Account): Promise<Account | null> {
  if (payment.status !== 'paid' || source.archivedAt || payment.payingAccountId === null) {
    return null;
  }

  return accounts.findOneBy({ id: payment.payingAccountId });
}
