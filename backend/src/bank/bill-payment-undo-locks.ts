import type { EntityManager } from 'typeorm';
import { Account } from './entities/account.entity.js';
import type { BillPayment } from './entities/bill-payment.entity.js';
import type { Reconciliation } from './entities/reconciliation.entity.js';
import { transactionCleared } from './reconciliation-conflicts.js';
import { lockStatement } from './reconciliation-guards.js';
import type { ReconciliationQuery } from './reconciliation.query.js';

// The locks of a payment undo, in the fixed order of `docs/agents/specs/reconciliation/security.md`
// (*Concurrency*): the account rows in ascending id, then the open statements of those accounts,
// then the linked transaction rows (ascending id per account). A payment touches up to two
// accounts: the source (payment and charge rows) and the paying account (the withdrawal row).

/**
 * The transactions a payment generated, by the account they live on.
 * @param {BillPayment} payment - The payment row.
 * @returns {Map<number, number[]>} The linked transaction ids of each account, ascending, accounts ascending.
 *   A skipped payment (no linked rows) yields an empty map.
 */
export function linkedTransactions(payment: BillPayment): Map<number, number[]> {
  const entries: Array<[number | null, number | null]> = [
    [payment.sourceAccountId, payment.paymentTransactionId],
    [payment.sourceAccountId, payment.chargeTransactionId],
    [payment.payingAccountId, payment.withdrawalTransactionId],
  ];
  const byAccount = new Map<number, number[]>();

  for (const [accountId, transactionId] of entries) {
    if (accountId !== null && transactionId !== null) {
      byAccount.set(accountId, [...(byAccount.get(accountId) ?? []), transactionId]);
    }
  }

  return new Map([...byAccount].sort(([a], [b]) => a - b).map(([accountId, ids]) => [accountId, ids.sort((a, b) => a - b)]));
}

/**
 * Locks the payment's account rows (`FOR UPDATE`) in ascending id order: the source, and the paying
 * account when it differs.
 * @param {EntityManager} manager - The write transaction's manager.
 * @param {BillPayment} payment - The payment row.
 * @returns {Promise<Map<number, Account>>} The locked accounts by id; an account that is gone is absent.
 */
export async function lockPaymentAccounts(manager: EntityManager, payment: BillPayment): Promise<Map<number, Account>> {
  const ids = [...new Set([payment.sourceAccountId, payment.payingAccountId].filter((id): id is number => id !== null))]
    .sort((a, b) => a - b);
  const locked = new Map<number, Account>();

  for (const id of ids) {
    const account = await manager.getRepository(Account).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });

    if (account) {
      locked.set(id, account);
    }
  }

  return locked;
}

/**
 * Locks the open statement of each account that has one (the accounts are already locked), then the
 * linked transaction rows, and refuses the undo when any of them is cleared.
 * @param {EntityManager} manager - The write transaction's manager.
 * @param {ReconciliationQuery} query - The statement lookups and the row lock.
 * @param {BillPayment} payment - The payment row.
 * @returns {Promise<void>}
 * @throws {ConflictException} 409 `TRANSACTION_CLEARED` when a linked row belongs to a finished statement.
 *   A ticked row passes: it is deleted and its tick goes with it.
 */
export async function lockPaymentRows(manager: EntityManager, query: ReconciliationQuery, payment: BillPayment): Promise<void> {
  const linked = linkedTransactions(payment);
  const open = new Map<number, Reconciliation | null>();

  for (const accountId of linked.keys()) {
    const statement = await query.openStatement(accountId, manager);

    if (statement) {
      await lockStatement(manager, accountId, statement.id);
    }

    open.set(accountId, statement);
  }

  for (const [accountId, ids] of linked) {
    const rows = await query.lockTransactions(manager, accountId, ids);

    if (rows.some((row) => row.reconciliationId !== null && row.reconciliationId !== open.get(accountId)?.id)) {
      throw transactionCleared();
    }
  }
}
