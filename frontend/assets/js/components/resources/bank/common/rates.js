import { formatMoney } from './amounts.js';

/** Unit label of a rate period / frequency (`monthly` → "month"). */
const PERIOD_UNITS = new Map([
  ['monthly', 'month'],
  ['yearly', 'year'],
]);

/**
 * Append the period unit to a value, e.g. "1.99%" + `monthly` → "1.99% / month".
 *
 * @param {string} value - The formatted value.
 * @param {string|null} period - `monthly`, `yearly` or `null`.
 * @returns {string} The value with its unit, or the value alone for an unknown period.
 */
function withPeriod(value, period) {
  const unit = PERIOD_UNITS.get(period);

  return unit ? `${value} / ${unit}` : value;
}

/**
 * Format a rate with its period, e.g. "1.99% / month" (a debt's interest rate, an
 * investment's yield rate).
 *
 * @description The API's decimal string is shown as-is (no trailing zeros, no rounding).
 * @param {string|null} rate - The `interest_rate` / `yield_rate` decimal string.
 * @param {string|null} period - The `interest_period` / `yield_period` (`monthly` | `yearly`).
 * @returns {string} The formatted rate, or `''` when no rate is set.
 */
export function formatRate(rate, period) {
  if (rate === null || rate === undefined || rate === '') {
    return '';
  }

  return withPeriod(`${rate}%`, period);
}

/**
 * Format a debt's instalment amount with its frequency, e.g. "R$ 500,00 / month".
 *
 * @param {string|null} amount - The `instalment_amount` decimal string.
 * @param {string|null} frequency - The `instalment_frequency` (`monthly` | `yearly`).
 * @param {string} currency - The account's ISO 4217 currency.
 * @returns {string} The formatted instalment, or `''` when no amount is set.
 */
export function formatInstalment(amount, frequency, currency) {
  const money = formatMoney(amount, currency);

  return money ? withPeriod(money, frequency) : '';
}

