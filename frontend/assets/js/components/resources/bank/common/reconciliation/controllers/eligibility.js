/**
 * Whether a ledger row can be ticked on the open statement.
 *
 * @description A row is eligible when it is a real transaction (not the opening row), dated on
 * or after the account's `opening_date` and on or before the statement date, and not cleared by
 * another statement.
 * @param {object} row - The ledger row.
 * @param {{account: object, statement: object}} context - The account and the open statement.
 * @returns {boolean} True when the row can be ticked.
 */
export function isEligible(row, { account, statement }) {
  if (!row || row.opening || row.id === undefined || row.id === null) {
    return false;
  }

  if (row.date < account.opening_date || row.date > statement.statement_date) {
    return false;
  }

  return !row.reconciliation || row.reconciliation.id === statement.id;
}

/**
 * Whether a row is ticked on the open statement: the local overlay wins over the server value.
 *
 * @param {object} row - The ledger row.
 * @param {{statement: object, ticked: Map<number, boolean>}} context - The open statement and
 *   the optimistic overlay.
 * @returns {boolean} True when the row is ticked.
 */
export function isTicked(row, { statement, ticked }) {
  if (ticked.has(row.id)) {
    return ticked.get(row.id);
  }

  return row.reconciliation?.id === statement.id;
}

/**
 * Whether a row is cleared by a finished statement (a row on an open statement is not).
 *
 * @param {object} row - The ledger row.
 * @returns {boolean} True when the row is cleared.
 */
export function isCleared(row) {
  return row.reconciliation?.status === 'finished';
}

/**
 * The ids of the eligible rows.
 *
 * @param {Array<object>} rows - The ledger rows.
 * @param {{account: object, statement: object}} context - The account and the open statement.
 * @returns {Array<number>} The eligible ids, in row order.
 */
export function eligibleIds(rows, context) {
  return rows.filter((row) => isEligible(row, context)).map((row) => row.id);
}

/**
 * The rows to show: all of them, or only the uncleared ones.
 *
 * @description A local filter, with no request: it drops the rows cleared by another statement
 * and the ones ticked on the open statement.
 * @param {Array<object>} rows - The ledger rows.
 * @param {{statement: object, ticked: Map<number, boolean>}} context - The open statement and
 *   the optimistic overlay.
 * @param {boolean} onlyUncleared - Whether the filter is on.
 * @returns {Array<object>} The rows to show.
 */
export function visibleRows(rows, context, onlyUncleared) {
  if (!onlyUncleared) {
    return rows;
  }

  return rows.filter((row) => {
    const clearedElsewhere = Boolean(row.reconciliation) && row.reconciliation.id !== context.statement.id;

    return !clearedElsewhere && !isTicked(row, context);
  });
}
