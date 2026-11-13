import { negateAmount, parseAmount } from '../../../common/amounts.js';
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
import {
  emptyScheduleFields,
  scheduleFieldsFromAccount,
  validateScheduleFields,
} from '../../../common/form/controllers/scheduleFields.js';

/** The debt-specific form fields (flat in the form, nested as `debt` in the body). */
export const DEBT_FIELD_NAMES = [
  'interest_rate', 'interest_period', 'instalment_amount', 'instalment_frequency', 'due_day',
  'due_month', 'instalment_count',
];

/** Largest instalment count accepted (the `int` column range). */
export const INSTALMENT_COUNT_MAX = INT_MAX;

/** The debt's rate / period field names and the missing-period message. */
const RATE_NAMES = { rate: 'interest_rate', period: 'interest_period', periodError: 'Choose the interest period' };

/**
 * Build the empty debt create form: the common fields (Amount owed `0`) plus empty debt fields,
 * the frequency defaulting to `monthly`, and the schedule fields (shown in the Calendar).
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
    ...emptyScheduleFields(),
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
    ...scheduleFieldsFromAccount(account.debt),
  };
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

  const rate = rateEntries(fields, RATE_NAMES);
  const instalment = instalmentEntries(fields);
  const schedule = validateScheduleFields(fields);
  const errors = {
    ...common.errors,
    ...Object.fromEntries(
      [...rate.errors, ...instalment.errors, ...schedule.errors].filter(([, error]) => error),
    ),
  };

  if (Object.keys(errors).length) {
    return { errors, body: null };
  }

  return { errors, body: { ...common.body, debt: { ...rate.values, ...instalment.values, ...schedule.values } } };
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
  return changedNestedFields(body, original, 'debt');
}
