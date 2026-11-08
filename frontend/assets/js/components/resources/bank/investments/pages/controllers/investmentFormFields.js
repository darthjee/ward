import {
  emptyAccountFields,
  fieldsFromAccount,
  validateAccountFields,
} from '../../../common/form/controllers/accountFormFields.js';
import {
  INT_MAX,
  changedNestedFields,
  integerIn,
  rateEntries,
  text,
} from '../../../common/form/controllers/nestedFields.js';
import { KIND_LABELS } from '../../common/investmentLabels.js';

/** The investment-specific form fields (flat in the form, nested as `investment` in the body). */
export const INVESTMENT_FIELD_NAMES = ['kind', 'yield_rate', 'yield_period', 'maturity_date', 'liquidity_days'];

/** Largest liquidity accepted, in days (the `int` column range). */
export const LIQUIDITY_DAYS_MAX = INT_MAX;

/** Label of the opening date on the investment form (and in its errors). */
export const START_DATE_LABEL = 'Start date';

/** The yield rate / period field names and the missing-period message. */
const RATE_NAMES = { rate: 'yield_rate', period: 'yield_period', periodError: 'Choose the yield period' };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Build the empty investment create form: the common fields (opening balance `0`, never shown)
 * plus empty investment fields.
 *
 * @param {string} [currency] - The default currency (`''` when unknown).
 * @param {string} [today] - Local today, `YYYY-MM-DD`.
 * @returns {object} The form fields.
 */
export function emptyInvestmentFields(currency = '', today) {
  return {
    ...emptyAccountFields(currency, today),
    ...Object.fromEntries(INVESTMENT_FIELD_NAMES.map((name) => [name, ''])),
  };
}

/**
 * Build the edit form from a loaded investment: the common fields plus the investment fields
 * as text (empty when unset).
 *
 * @param {object} account - The investment account response.
 * @returns {object} The form fields.
 */
export function investmentFieldsFromAccount(account) {
  const investment = new Map(Object.entries(account.investment ?? {}));

  return {
    ...fieldsFromAccount(account),
    ...Object.fromEntries(INVESTMENT_FIELD_NAMES.map((name) => [name, text(investment.get(name))])),
  };
}

/**
 * Whether a `YYYY-MM-DD` string is a real calendar date (e.g. not `2026-02-30`).
 *
 * @param {string} value - The date string.
 * @returns {boolean} `true` for a real date.
 */
function isCalendarDate(value) {
  const match = DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Validate the kind, maturity date and liquidity: a kind of the enum, any real date (past
 * allowed) and an integer from 0; each optional (`null` when empty).
 *
 * @param {object} fields - The form fields.
 * @returns {{errors: Array<Array>, values: object}} Error entries and the body values.
 */
function detailEntries(fields) {
  const kind = text(fields.kind);
  const kindValid = !kind || KIND_LABELS.has(kind);
  const maturity = text(fields.maturity_date);
  const maturityValid = !maturity || isCalendarDate(maturity);
  const liquidity = integerIn(fields.liquidity_days, [0, LIQUIDITY_DAYS_MAX], 'Enter a whole number of days (0 or more)');

  return {
    errors: [
      ['kind', kindValid ? null : 'Choose a valid kind'],
      ['maturity_date', maturityValid ? null : 'Enter a valid date'],
      ['liquidity_days', liquidity.error],
    ],
    values: {
      kind: kind && kindValid ? kind : null,
      maturity_date: maturity && maturityValid ? maturity : null,
      liquidity_days: liquidity.value,
    },
  };
}

/**
 * Validate the investment form and build the body: the common account body (opening balance
 * `0` from the hidden field) plus the nested `investment` object, every key present.
 *
 * @description With `nameOnly` (an archived investment) the body carries only `name`. The
 * opening date errors read "Start date …". An empty yield rate sends `yield_rate: null` and
 * `yield_period: null` together; once a rate is entered the period is required.
 * @param {object} fields - The form fields.
 * @param {{nameOnly: boolean, now: Date}} [options] - Validation options.
 * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
 */
export function validateInvestmentFields(fields, { nameOnly = false, now = new Date() } = {}) {
  const common = validateAccountFields(fields, { nameOnly, now, dateLabel: START_DATE_LABEL });

  if (nameOnly) {
    return common;
  }

  const rate = rateEntries(fields, RATE_NAMES);
  const details = detailEntries(fields);
  const errors = {
    ...common.errors,
    ...Object.fromEntries([...rate.errors, ...details.errors].filter(([, error]) => error)),
  };

  if (Object.keys(errors).length) {
    return { errors, body: null };
  }

  return { errors, body: { ...common.body, investment: { ...details.values, ...rate.values } } };
}

/**
 * Keep only what changed against the loaded investment: the changed common fields and, inside
 * `investment`, the changed keys (`null` clears).
 *
 * @param {object} body - The validated body.
 * @param {object} original - The body built from the loaded investment.
 * @returns {object} The PATCH body (without `investment` when no investment field changed).
 */
export function changedInvestmentFields(body, original) {
  return changedNestedFields(body, original, 'investment');
}
