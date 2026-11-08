/** Display label of each investment kind. */
export const KIND_LABELS = new Map([
  ['fixed_income', 'Fixed income'],
  ['fund', 'Fund'],
  ['stocks', 'Stocks'],
  ['savings', 'Savings'],
  ['pension', 'Pension'],
  ['crypto', 'Crypto'],
  ['other', 'Other'],
]);

/** The kind select options, as `[value, label]` pairs in display order. */
export const KIND_OPTIONS = [...KIND_LABELS];

/**
 * Read the display label of an investment kind.
 *
 * @param {string|null} kind - The API kind (e.g. `fixed_income`).
 * @returns {string} The label (e.g. "Fixed income"), or `''` when unset or unknown.
 */
export function kindLabel(kind) {
  return KIND_LABELS.get(kind) ?? '';
}

/**
 * Format the liquidity (redemption delay in days) as "D+N".
 *
 * @param {number|null} days - The `liquidity_days` value.
 * @returns {string} "D+N" (e.g. "D+0", "D+30"), or `''` when unset.
 */
export function formatLiquidity(days) {
  return days === null || days === undefined || days === '' ? '' : `D+${days}`;
}
