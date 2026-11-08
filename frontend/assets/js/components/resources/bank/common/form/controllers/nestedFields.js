import { changedFields } from './accountFormFields.js';

/** Accepted rate periods / frequencies. */
export const PERIODS = ['monthly', 'yearly'];

/** Largest value of an `int` column (instalment count, liquidity days). */
export const INT_MAX = 2147483647;

const RATE_PATTERN = /^(\d{1,3})(?:[.,](\d{1,4}))?$/;
const INTEGER_PATTERN = /^\d+$/;

/**
 * Trim a raw form value.
 *
 * @param {*} value - The raw value.
 * @returns {string} The trimmed text.
 */
export function text(value) {
  return String(value ?? '').trim();
}

/**
 * Validate a rate (0–100, at most 4 decimals) and its paired period (required with a rate).
 *
 * @description An empty rate clears both fields (`null` together). `,` is accepted as the
 * decimal separator and normalised to `.`.
 * @param {object} fields - The form fields.
 * @param {{rate: string, period: string, periodError: string}} names - The rate and period
 *   field names and the message shown when the period is missing.
 * @returns {{errors: Array<Array>, values: object}} Error entries and the body values.
 */
export function rateEntries(fields, { rate: rateName, period: periodName, periodError }) {
  const source = new Map(Object.entries(fields));
  const rate = text(source.get(rateName));

  if (!rate) {
    return { errors: [], values: Object.fromEntries([[rateName, null], [periodName, null]]) };
  }

  const match = RATE_PATTERN.exec(rate);
  const value = match ? `${match[1]}${match[2] ? `.${match[2]}` : ''}` : null;
  const rateError = value !== null && Number(value) <= 100
    ? null
    : 'Enter a rate between 0 and 100, with at most 4 decimals';
  const rawPeriod = source.get(periodName);
  const period = PERIODS.includes(rawPeriod) ? rawPeriod : null;

  return {
    errors: [[rateName, rateError], [periodName, period ? null : periodError]],
    values: Object.fromEntries([[rateName, value], [periodName, period]]),
  };
}

/**
 * Validate an optional integer within a range.
 *
 * @param {*} raw - The raw value.
 * @param {Array<number>} range - `[min, max]`, inclusive.
 * @param {string} message - The error message.
 * @returns {{error: (string|null), value: (number|null)}} The error, or the integer (`null`
 *   when empty).
 */
export function integerIn(raw, [min, max], message) {
  const value = text(raw);

  if (!value) {
    return { error: null, value: null };
  }

  const number = INTEGER_PATTERN.test(value) ? Number(value) : NaN;

  return number >= min && number <= max ? { error: null, value: number } : { error: message, value: null };
}

/**
 * Keep only what changed against the loaded account: the changed top-level fields and, inside
 * the nested object `key` (e.g. `debt`, `investment`), the changed keys (`null` clears).
 *
 * @param {object} body - The validated body.
 * @param {object} original - The body built from the loaded account.
 * @param {string} key - The nested object's key.
 * @returns {object} The PATCH body (without `key` when nothing inside it changed).
 */
export function changedNestedFields(body, original, key) {
  const source = new Map(Object.entries(body));
  const nested = source.get(key);
  const rest = Object.fromEntries([...source].filter(([name]) => name !== key));
  const changed = changedFields(rest, original);

  if (!nested) {
    return changed;
  }

  const nestedChanges = changedFields(nested, new Map(Object.entries(original ?? {})).get(key));

  return Object.keys(nestedChanges).length ? { ...changed, [key]: nestedChanges } : changed;
}
