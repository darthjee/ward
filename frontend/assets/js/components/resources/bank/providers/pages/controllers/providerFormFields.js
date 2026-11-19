import {
  emptyAccountFields,
  fieldsFromAccount,
  validateAccountFields,
} from '../../../common/form/controllers/accountFormFields.js';
import { changedNestedFields, text } from '../../../common/form/controllers/nestedFields.js';

/** The provider-specific form fields (flat in the form, nested as `provider_expense`). */
export const PROVIDER_FIELD_NAMES = ['for_accountant', 'provider_tax_id'];

/** Largest provider tax id accepted (mirrors the backend). */
export const TAX_ID_MAX_LENGTH = 32;

/**
 * Build the empty provider create form: the common fields plus the provider fields, For
 * accountant on (the schedule lives on the provider's bills).
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
  };
}

/**
 * Build the edit form from a loaded provider: unset provider fields are empty and For
 * accountant defaults to on.
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
 * Validate the provider fields: For accountant and the tax id.
 *
 * @param {object} fields - The form fields.
 * @returns {{errors: Array<Array>, values: object}} Error entries and the body values.
 */
function providerEntries(fields) {
  const taxId = taxIdEntry(fields.provider_tax_id);

  return {
    errors: [['provider_tax_id', taxId.error]],
    values: { for_accountant: Boolean(fields.for_accountant), provider_tax_id: taxId.value },
  };
}

/**
 * Validate the provider form and build the body: the common account body (the opening balance
 * is the anchor, any sign) plus the nested `provider_expense` object.
 *
 * @description With `nameOnly` (an archived provider) the body carries only `name`. Mirrors
 * the backend: tax id ≤ 32 characters (blank → `null`). No schedule fields are sent.
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
