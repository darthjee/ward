import { negateAmount, parseAmount } from '../../../common/amounts.js';
import {
  changedFields,
  emptyAccountFields,
  fieldsFromAccount,
  validateAccountFields,
} from '../../../common/form/controllers/accountFormFields.js';

/** The debt-specific form fields (flat in the form, nested as `debt` in the body). */
export const DEBT_FIELD_NAMES = [
  'interest_rate', 'interest_period', 'instalment_amount', 'instalment_frequency', 'due_day',
  'due_month', 'instalment_count',
];

/** Accepted periods / frequencies. */
export const PERIODS = ['monthly', 'yearly'];

/** Largest instalment count accepted (the `int` column range). */
export const INSTALMENT_COUNT_MAX = 2147483647;

const RATE_PATTERN = /^(\d{1,3})(?:[.,](\d{1,4}))?$/;
const INTEGER_PATTERN = /^\d+$/;

/**
 * Trim a raw form value.
 *
 * @param {*} value - The raw value.
 * @returns {string} The trimmed text.
 */
function text(value) {
  return String(value ?? '').trim();
}

/**
 * Build the empty debt create form: the common fields (Amount owed `0`) plus empty debt fields,
 * the frequency defaulting to `monthly`.
 *
 * @param {string} [currency] - The default currency (`''` when unknown).
 * @param {string} [today] - Local today, `YYYY-MM-DD`.
 * @returns {object} The form fields.
 */
export function emptyDebtFields(currency = '', today) {
  return {
    ...emptyAccountFields(currency, today),
    interest_rate: '',
    interest_period: '',
    instalment_amount: '',
    instalment_frequency: 'monthly',
    due_day: '',
    due_month: '',
    instalment_count: '',
  };
}

/**
 * Build the edit form from a loaded debt: the stored opening balance is shown negated as the
 * Amount owed (`-10000.00` → `10000.00`), unset debt fields are empty.
 *
 * @param {object} account - The debt account response.
 * @returns {object} The form fields.
 */
export function debtFieldsFromAccount(account) {
  const debt = new Map(Object.entries(account.debt ?? {}));
  const common = fieldsFromAccount(account);

  return {
    ...common,
    opening_balance: negateAmount(common.opening_balance),
    ...Object.fromEntries(DEBT_FIELD_NAMES.map((name) => [name, text(debt.get(name))])),
    instalment_frequency: debt.get('instalment_frequency') ?? 'monthly',
  };
}

/**
 * Validate the interest rate (0–100, at most 4 decimals) and its period (required with a rate).
 * An empty rate clears both.
 *
 * @param {object} fields - The form fields.
 * @returns {{errors: Array<Array>, values: object}} Error entries and the body values.
 */
function rateEntries(fields) {
  const rate = text(fields.interest_rate);

  if (!rate) {
    return { errors: [], values: { interest_rate: null, interest_period: null } };
  }

  const match = RATE_PATTERN.exec(rate);
  const value = match ? `${match[1]}${match[2] ? `.${match[2]}` : ''}` : null;
  const rateError = value !== null && Number(value) <= 100
    ? null
    : 'Enter a rate between 0 and 100, with at most 4 decimals';
  const period = PERIODS.includes(fields.interest_period) ? fields.interest_period : null;

  return {
    errors: [['interest_rate', rateError], ['interest_period', period ? null : 'Choose the interest period']],
    values: { interest_rate: value, interest_period: period },
  };
}

/**
 * Validate an optional integer within a range.
 *
 * @param {*} raw - The raw value.
 * @param {number} min - The smallest accepted value.
 * @param {number} max - The largest accepted value.
 * @param {string} message - The error message.
 * @returns {{error: (string|null), value: (number|null)}} The error, or the integer (`null`
 *   when empty).
 */
function integerIn(raw, [min, max], message) {
  const value = text(raw);

  if (!value) {
    return { error: null, value: null };
  }

  const number = INTEGER_PATTERN.test(value) ? Number(value) : NaN;

  return number >= min && number <= max ? { error: null, value: number } : { error: message, value: null };
}

/**
 * Validate the instalment fields: amount (> 0, in the account currency), frequency, due day,
 * due month (required for `yearly`, `null` for `monthly`) and count.
 *
 * @param {object} fields - The form fields.
 * @returns {{errors: Array<Array>, values: object}} Error entries and the body values.
 */
function instalmentEntries(fields) {
  const rawAmount = text(fields.instalment_amount);
  const amount = rawAmount ? parseAmount(rawAmount, { currency: fields.currency || undefined }) : { value: null };
  const frequency = fields.instalment_frequency === 'yearly' ? 'yearly' : 'monthly';
  const dueDay = integerIn(fields.due_day, [1, 31], 'Enter a day between 1 and 31');
  const dueMonth = frequency === 'yearly' ? integerIn(fields.due_month, [1, 12], '').value : null;
  const count = integerIn(fields.instalment_count, [1, INSTALMENT_COUNT_MAX], 'Enter a whole number of at least 1');

  return {
    errors: [
      ['instalment_amount', amount.error ?? null],
      ['due_day', dueDay.error],
      ['due_month', frequency === 'yearly' && dueMonth === null ? 'Choose the due month' : null],
      ['instalment_count', count.error],
    ],
    values: {
      instalment_amount: amount.value ?? null,
      instalment_frequency: frequency,
      due_day: dueDay.value,
      due_month: dueMonth,
      instalment_count: count.value,
    },
  };
}

/**
 * Validate the debt form and build the body: the common account body (with the Amount owed
 * negated into `opening_balance`) plus the nested `debt` object.
 *
 * @description With `nameOnly` (an archived debt) the body carries only `name`. An empty rate
 * sends `interest_rate: null` and `interest_period: null` together; once a rate is entered the
 * period is required. Due month is required for a yearly frequency and `null` for monthly.
 * @param {object} fields - The form fields.
 * @param {{nameOnly: boolean, now: Date}} [options] - Validation options.
 * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
 */
export function validateDebtFields(fields, { nameOnly = false, now = new Date() } = {}) {
  const common = validateAccountFields(
    { ...fields, opening_balance: negateAmount(fields.opening_balance) },
    { nameOnly, now },
  );

  if (nameOnly) {
    return common;
  }

  const rate = rateEntries(fields);
  const instalment = instalmentEntries(fields);
  const errors = {
    ...common.errors,
    ...Object.fromEntries([...rate.errors, ...instalment.errors].filter(([, error]) => error)),
  };

  if (Object.keys(errors).length) {
    return { errors, body: null };
  }

  return { errors, body: { ...common.body, debt: { ...rate.values, ...instalment.values } } };
}

/**
 * Keep only what changed against the loaded debt: the changed common fields and, inside
 * `debt`, the changed keys (`null` clears).
 *
 * @param {object} body - The validated body.
 * @param {object} original - The body built from the loaded debt.
 * @returns {object} The PATCH body (without `debt` when no debt field changed).
 */
export function changedDebtFields(body, original) {
  const { debt, ...rest } = body;
  const changed = changedFields(rest, original);

  if (!debt) {
    return changed;
  }

  const debtChanges = changedFields(debt, original?.debt);

  return Object.keys(debtChanges).length ? { ...changed, debt: debtChanges } : changed;
}
