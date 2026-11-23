import type { Reconciliation } from '../../entities/reconciliation.entity.js';
import type { Transaction } from '../../entities/transaction.entity.js';
import { matches, mysqlError, type Where } from './in-memory-where.js';

// The `bank_reconciliations` rules of the in-memory bank repositories (see
// `docs/agents/specs/reconciliation/model.md`): the unique-open key, `ON DELETE SET NULL` of
// `bank_transactions.reconciliation_id` and (wired in `in-memory-bank-repos.ts`) `ON DELETE
// CASCADE` from the account. The `pessimistic_write` lock is recorded by the generic repo's
// `findOne({ where, lock })` into `repo.locks`. The real schema is covered by the MySQL
// integration specs.

type Rows<T> = { rows: T[]; delete: (where: Where) => Promise<{ affected: number }> };

/**
 * The generated `open_key` unique index: an account has at most one statement with
 * `reconciledAt === null`.
 * @param {Reconciliation} candidate - The row being saved.
 * @param {Reconciliation[]} others - Every other row.
 * @returns {void}
 * @throws {QueryFailedError} `ER_DUP_ENTRY` when another open statement exists for the account.
 */
export function checkOpenKey(candidate: Reconciliation, others: Reconciliation[]): void {
  const clash = candidate.reconciledAt === null &&
    others.some((other) => other.accountId === candidate.accountId && other.reconciledAt === null);

  if (clash) {
    throw mysqlError('ER_DUP_ENTRY');
  }
}

/**
 * Makes deleting a reconciliation behave like `ON DELETE SET NULL`: the transactions ticked on it
 * keep existing, with `reconciliationId` reset to `null`.
 * @param {Rows<Reconciliation>} reconciliations - The reconciliations repo (its `delete` is wrapped).
 * @param {Rows<Transaction>} transactions - The transactions repo.
 * @returns {void}
 */
export function wireReconciliationDeletes(reconciliations: Rows<Reconciliation>, transactions: Rows<Transaction>): void {
  const deleteReconciliation = reconciliations.delete;

  reconciliations.delete = async (where: Where) => {
    const doomed = new Set(reconciliations.rows.filter((row) => matches(row, where)).map((row) => row.id));
    const result = await deleteReconciliation(where);

    for (const transaction of transactions.rows) {
      if (transaction.reconciliationId !== null && doomed.has(transaction.reconciliationId)) {
        transaction.reconciliationId = null;
      }
    }

    return result;
  };
}
