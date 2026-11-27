// Pure money helpers of the reconciliation formulas (see
// `docs/agents/modules/bank/reconciliation.md`, *Formulas*). Every computation is done in `bigint`,
// never `Number`, so values near the 10^13 bound keep full precision.
//
// Debt sign: the API takes and returns the signed value (a debt account's balance is negative) and
// the UI negates it for display. The server never negates anything here.

/** The state of a statement, derived from `reconciledAt`. */
export type ReconciliationStatus = 'open' | 'finished';

/**
 * @param {string | null | undefined} raw - A SQL `SUM` as the driver returns it (a decimal string),
 *   or `NULL` when no row matched.
 * @returns {bigint} The sum as a `bigint`; `NULL` (or absent) is `0n`.
 */
export function sumToBigInt(raw: string | null | undefined): bigint {
  return raw === null || raw === undefined ? 0n : BigInt(raw);
}

/**
 * @param {bigint} openingBalance - The account's opening balance (the anchor).
 * @param {bigint} clearedSum - The sum of the transactions on finished statements.
 * @returns {bigint} The cleared balance: `openingBalance + clearedSum`.
 */
export function clearedBalance(openingBalance: bigint, clearedSum: bigint): bigint {
  return openingBalance + clearedSum;
}

/**
 * @param {bigint} statementBalance - The balance the bank statement shows.
 * @param {bigint} cleared - The cleared balance (see {@link clearedBalance}).
 * @param {bigint} ticked - The sum of the transactions ticked on the open statement.
 * @returns {bigint} The difference: `statementBalance - (cleared + ticked)`; zero when balanced.
 */
export function reconciliationDifference(statementBalance: bigint, cleared: bigint, ticked: bigint): bigint {
  return statementBalance - (cleared + ticked);
}

/**
 * @param {bigint} difference - A statement's difference.
 * @returns {boolean} `true` when the statement is balanced (difference zero).
 */
export function isBalanced(difference: bigint): boolean {
  return difference === 0n;
}

/**
 * @param {Date | null} reconciledAt - The statement's `reconciledAt`.
 * @returns {ReconciliationStatus} `open` while `reconciledAt` is `null`, `finished` once it is set.
 */
export function reconciliationStatus(reconciledAt: Date | null): ReconciliationStatus {
  return reconciledAt === null ? 'open' : 'finished';
}
