import { sumAmounts } from '../../common/amounts.js';

/**
 * Total the preview charges per currency, never across currencies.
 *
 * @description Amounts are summed exactly in minor units (see `sumAmounts`); the result is
 * ordered by currency code so the totals lines are stable.
 * @param {Array<object>} charges - The preview charges (each with `amount` and
 *   `account.currency`).
 * @returns {Array<{currency: string, total: string}>} One total per currency, as a decimal
 *   string in that currency's exponent.
 */
export function totalsByCurrency(charges) {
  const groups = new Map();

  (charges ?? []).forEach((charge) => {
    const currency = charge.account?.currency ?? '';

    groups.set(currency, [...(groups.get(currency) ?? []), charge.amount]);
  });

  return [...groups.keys()].sort().map((currency) => ({
    currency, total: sumAmounts(groups.get(currency), currency),
  }));
}

/**
 * Count charges in words: "1 charge", "3 charges".
 *
 * @param {number} count - The number of charges.
 * @returns {string} The count with its noun.
 */
export function chargeCount(count) {
  return `${count} ${count === 1 ? 'charge' : 'charges'}`;
}
