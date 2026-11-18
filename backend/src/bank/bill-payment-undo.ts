import type { Repository } from 'typeorm';
import { accountArchived } from './account-conflicts.js';
import type { BillPaymentWriter } from './bill-payment.writer.js';
import { ownerNotFound } from '../core/parse-id.js';
import type { Account } from './entities/account.entity.js';
import type { BillPayment } from './entities/bill-payment.entity.js';

/**
 * The shared undo checks 3-6 of `docs/agents/modules/bank/bills.md`: no row
 * and a skip on an archived source answer 404; a paid row with an archived
 * source or paying account answers 409 `ACCOUNT_ARCHIVED`; otherwise the row
 * and its transactions are removed.
 * @param {BillPaymentWriter} writer - The atomic payment writes.
 * @param {Repository<Account>} accounts - Reads the paying account.
 * @param {Account} source - The source (debt / provider) account.
 * @param {BillPayment | null} payment - The occurrence's payment row, if any.
 * @returns {Promise<void>}
 * @throws {NotFoundException} 404 without a row, or for a skip on an archived source.
 * @throws {ConflictException} 409 when a paid row's source or paying account is archived.
 */
export async function undoPayment(
  writer: BillPaymentWriter,
  accounts: Repository<Account>,
  source: Account,
  payment: BillPayment | null,
): Promise<void> {
  if (!payment || (payment.status === 'skipped' && source.archivedAt)) {
    throw ownerNotFound();
  }

  if (payment.status === 'paid' && (source.archivedAt || (await payingArchived(accounts, payment)))) {
    throw accountArchived();
  }

  await writer.remove(payment);
}

async function payingArchived(accounts: Repository<Account>, payment: BillPayment): Promise<boolean> {
  if (payment.payingAccountId === null) {
    return false;
  }

  const paying = await accounts.findOneBy({ id: payment.payingAccountId });

  return Boolean(paying?.archivedAt);
}
