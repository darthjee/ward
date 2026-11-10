import { parseAmount } from '../../../common/amounts.js';
import {
  emptyAccountFields,
  fieldsFromAccount,
  validateAccountFields,
} from '../../../common/form/controllers/accountFormFields.js';
import {
  changedNestedFields,
  integerIn,
  text,
} from '../../../common/form/controllers/nestedFields.js';

/** The provider-specific form fields (flat in the form, nested as `provider_expense`). */
export const PROVIDER_FIELD_NAMES = [
  'for_accountant', 'provider_tax_id', 'expected_amount', 'charge_frequency', 'due_day',
  'due_month',
];

/** Largest provider tax id accepted (mirrors the backend). */
export const TAX_ID_MAX_LENGTH = 32;

/**
 * Build the empty provider create form: the common fields plus the provider fields, For
 * accountant on and the frequency defaulting to `monthly`.
 *
 * @param {string} [currency] - The default currency (`''` when unknown).
 * @param {string} [today] - Local today, `YYYY-MM-DD`.
 * @returns {object} The form fields.
 */
export function emptyProviderFields(currency = '', today = undefined) {
  return {
    ...emptyAccountFields(currency, today),
    for_accountant: true,
    provider_tax_id: '',
    expected_amount: '',
    charge_frequency: 'monthly',
    due_day: '',
    due_month: '',
  };
}

/**
 * Build the edit form from a loaded provider: unset provider fields are empty, For accountant
 * defaults to on and the frequency to `monthly`.
 *
 * @param {object} account - The provider-expense account response.
 * @returns {object} The form fields.
 */
export function providerFieldsFromAccount(account) {
  const details = new Map(Object.entries(account.provider_expense ?? {}));

  return {
    ...fieldsFromAccount(account),
    ...Object.fromEntries(PROVIDER_FIELD_NAMES.map((name) => [name, text(details.get(name))])),
    for_accountant: details.get('for_accountant') ?? true,
    charge_frequency: details.get('charge_frequency') ?? 'monthly',
  };
}

/**
 * Validate the provider tax id: trimmed, at most 32 characters, `null` when blank.
 *
 * @param {*} raw - The raw value.
 * @returns {{error: (string|null), value: (string|null)}} The error, or the value.
 */
function taxIdEntry(raw) {
  const value = text(raw);

  if (value.length > TAX_ID_MAX_LENGTH) {
    return { error: `Use at most ${TAX_ID_MAX_LENGTH} characters`, value: null };
  }

  return { error: null, value: value || null };
}

/**
 * Validate the optional expected amount: > 0 and valid for the account currency.
 *
 * @param {object} fields - The form fields.
 * @returns {{error: (string|null), value: (string|null)}} The error, or the decimal string.
 */
function expectedAmountEntry(fields) {
  const raw = text(fields.expected_amount);

  if (!raw) {
    return { error: null, value: null };
  }

  const parsed = parseAmount(raw, { currency: fields.currency || undefined });

  return { error: parsed.error ?? null, value: parsed.value ?? null };
}

/**
 * Validate the provider fields: tax id, expected amount, frequency, due day and due month
 * (required for `yearly`, `null` for `monthly`).
 *
 * @param {object} fields - The form fields.
 * @returns {{errors: Array<Array>, values: object}} Error entries and the body values.
 */
function providerEntries(fields) {
  const taxId = taxIdEntry(fields.provider_tax_id);
  const amount = expectedAmountEntry(fields);
  const frequency = fields.charge_frequency === 'yearly' ? 'yearly' : 'monthly';
  const dueDay = integerIn(fields.due_day, [1, 31], 'Enter a day between 1 and 31');
  const dueMonth = frequency === 'yearly' ? integerIn(fields.due_month, [1, 12], '').value : null;

  return {
    errors: [
      ['provider_tax_id', taxId.error],
      ['expected_amount', amount.error],
      ['due_day', dueDay.error],
      ['due_month', frequency === 'yearly' && dueMonth === null ? 'Choose the due month' : null],
    ],
    values: {
      for_accountant: Boolean(fields.for_accountant),
      provider_tax_id: taxId.value,
      expected_amount: amount.value,
      charge_frequency: frequency,
      due_day: dueDay.value,
      due_month: dueMonth,
    },
  };
}

/**
 * Validate the provider form and build the body: the common account body (the opening balance
 * is the anchor, any sign) plus the nested `provider_expense` object.
 *
 * @description With `nameOnly` (an archived provider) the body carries only `name`. Mirrors
 * the backend: tax id ≤ 32 characters (blank → `null`), expected amount > 0 in the account
 * currency (optional), due day 1–31, due month 1–12 required for `yearly` and `null` for
 * `monthly`.
 * @param {object} fields - The form fields.
 * @param {{nameOnly: boolean, now: Date}} [options] - Validation options.
 * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
 */
export function validateProviderFields(fields, { nameOnly = false, now = new Date() } = {}) {
  const common = validateAccountFields(fields, { nameOnly, now });

  if (nameOnly) {
    return common;
  }

  const provider = providerEntries(fields);
  const errors = {
    ...common.errors,
    ...Object.fromEntries(provider.errors.filter(([, error]) => error)),
  };

  if (Object.keys(errors).length) {
    return { errors, body: null };
  }

  return { errors, body: { ...common.body, provider_expense: provider.values } };
}

/**
 * Keep only what changed against the loaded provider: the changed common fields and, inside
 * `provider_expense`, the changed keys (`null` clears).
 *
 * @param {object} body - The validated body.
 * @param {object} original - The body built from the loaded provider.
 * @returns {object} The PATCH body (without `provider_expense` when nothing in it changed).
 */
export function changedProviderFields(body, original) {
  return changedNestedFields(body, original, 'provider_expense');
}
