// Pure eligibility rules of the reconciliation (see `docs/agents/specs/reconciliation/model.md`,
// *Transaction change*, *Statement lifecycle* and *Lock matrix*). Dates are `YYYY-MM-DD` strings
// compared lexically, as elsewhere with `ledger-date.ts`.

/** Why a transaction cannot be ticked on the open statement. */
export type IneligibilityReason = 'after_statement' | 'before_opening' | 'cleared_elsewhere';

/**
 * @param {{ date: string, reconciliationId: number | null }} row - The transaction.
 * @param {{ id: number, statementDate: string }} statement - The account's open statement. The caller
 *   passes only the open one, so a link to any other statement means a finished one.
 * @param {{ openingDate: string }} account - The account.
 * @returns {IneligibilityReason | null} The reason the row cannot be ticked, or `null` when it can
 *   (including a row already ticked on this statement).
 */
export function ineligibilityReason(
  row: { date: string; reconciliationId: number | null },
  statement: { id: number; statementDate: string },
  account: { openingDate: string },
): IneligibilityReason | null {
  if (row.reconciliationId !== null && row.reconciliationId !== statement.id) {
    return 'cleared_elsewhere';
  }
  if (row.date > statement.statementDate) {
    return 'after_statement';
  }
  if (row.date < account.openingDate) {
    return 'before_opening';
  }

  return null;
}

/**
 * @param {{ date: string, reconciliationId: number | null }} row - The transaction.
 * @param {{ id: number, statementDate: string }} statement - The account's open statement.
 * @param {{ openingDate: string }} account - The account.
 * @returns {boolean} `true` when the row can be ticked on the statement.
 */
export function isEligibleToTick(
  row: { date: string; reconciliationId: number | null },
  statement: { id: number; statementDate: string },
  account: { openingDate: string },
): boolean {
  return ineligibilityReason(row, statement, account) === null;
}

/**
 * @param {string} newDate - The transaction's new date.
 * @param {{ statementDate: string }} openStatement - The open statement the row is ticked on.
 * @param {{ openingDate: string }} account - The account.
 * @returns {boolean} `true` when moving the row to `newDate` must untick it: strictly after the
 *   statement date or strictly before the opening date (the boundaries keep the tick).
 */
export function shouldAutoUntick(
  newDate: string,
  openStatement: { statementDate: string },
  account: { openingDate: string },
): boolean {
  return newDate > openStatement.statementDate || newDate < account.openingDate;
}
