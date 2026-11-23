import { formatAmount } from './currency.js';
import type { Reconciliation } from './entities/reconciliation.entity.js';
import type { Pagination } from './pagination.js';
import { reconciliationDifference, reconciliationStatus, type ReconciliationStatus } from './reconciliation-balance.js';

/** The computed values presented next to a statement. */
export interface StatementMetrics {
  /**
   * The account's cleared balance (see `AccountBalancesQuery#clearedBalance`). Read for an open
   * statement only; `null` is accepted for a finished one, which does not need it.
   */
  clearedBalance: bigint | null;
  /** The sum of the transactions linked to the statement. */
  tickedSum: bigint;
  /** The number of transactions linked to the statement. */
  transactionCount: number;
}

/** The public view of a statement (snake_case; never an owner, user or member field). */
export interface StatementResponse {
  id: number;
  status: ReconciliationStatus;
  statement_date: string;
  statement_balance: string;
  reconciled_at: Date | null;
  cleared_balance: string;
  ticked_sum: string;
  difference: string;
  transaction_count: number;
  created_at: Date;
  updated_at: Date;
}

/** One row of the history envelope. */
export interface HistoryRowResponse {
  id: number;
  status: ReconciliationStatus;
  statement_date: string;
  statement_balance: string;
  reconciled_at: Date | null;
  transaction_count: number;
  /** `true` only on the latest finished statement while none is open. */
  undoable: boolean;
}

/** The envelope of `GET <base>/accounts/:accountId/reconciliations.json`. */
export interface HistoryResponse {
  reconciliations: HistoryRowResponse[];
  pagination: Pagination;
}

/**
 * Presents a statement with its computed values.
 *
 * An open statement shows the live values: `difference = statement_balance - (cleared_balance +
 * ticked_sum)`. A finished statement was balanced when it was finished and its rows are locked, so
 * its difference is `0`, `ticked_sum` is the amount it cleared, and `cleared_balance` is the
 * balance before it (`statement_balance - ticked_sum`), independent of any later statement.
 * @param {Reconciliation} statement - The statement.
 * @param {StatementMetrics} metrics - Its computed values.
 * @param {string} currency - The account's currency.
 * @returns {StatementResponse} The statement's public view; amounts are decimal strings.
 */
export function presentStatement(statement: Reconciliation, metrics: StatementMetrics, currency: string): StatementResponse {
  const status = reconciliationStatus(statement.reconciledAt);
  const cleared = status === 'finished'
    ? statement.statementBalance - metrics.tickedSum
    : (metrics.clearedBalance ?? 0n);
  const difference = reconciliationDifference(statement.statementBalance, cleared, metrics.tickedSum);

  return {
    id: statement.id,
    status,
    statement_date: statement.statementDate,
    statement_balance: formatAmount(statement.statementBalance, currency),
    reconciled_at: statement.reconciledAt,
    cleared_balance: formatAmount(cleared, currency),
    ticked_sum: formatAmount(metrics.tickedSum, currency),
    difference: formatAmount(difference, currency),
    transaction_count: metrics.transactionCount,
    created_at: statement.createdAt,
    updated_at: statement.updatedAt,
  };
}

/**
 * @param {Reconciliation} statement - The statement.
 * @param {number} transactionCount - The number of transactions linked to it.
 * @param {boolean} undoable - Whether it is the latest finished statement with none open.
 * @param {string} currency - The account's currency.
 * @returns {HistoryRowResponse} The history row.
 */
export function presentHistoryRow(
  statement: Reconciliation,
  transactionCount: number,
  undoable: boolean,
  currency: string,
): HistoryRowResponse {
  return {
    id: statement.id,
    status: reconciliationStatus(statement.reconciledAt),
    statement_date: statement.statementDate,
    statement_balance: formatAmount(statement.statementBalance, currency),
    reconciled_at: statement.reconciledAt,
    transaction_count: transactionCount,
    undoable,
  };
}
