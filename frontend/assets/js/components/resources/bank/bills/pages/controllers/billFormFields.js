import { parseAmount } from '../../../common/amounts.js';
import { localToday } from '../../../common/dates.js';
import { changedFields } from '../../../common/form/controllers/accountFormFields.js';
import { payingAccountOptions } from '../../../common/form/controllers/scheduleFields.js';
import { text } from '../../../common/form/controllers/nestedFields.js';

/** Largest bill description accepted (mirrors the backend). */
export const DESCRIPTION_MAX_LENGTH = 255;

/** Largest bill notes accepted (mirrors the backend). */
export const NOTES_MAX_LENGTH = 2000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Build the empty bill create form: the pre-selected provider (if any), due today.
 *
 * @param {string} [providerId] - The provider pre-selected by `?provider=:id`.
 * @param {string} [today] - Local today, `YYYY-MM-DD`.
 * @returns {object} The form fields.
 */
export function emptyBillFields(providerId = '', today = localToday()) {
  return {
    provider_account_id: providerId,
    paying_account_id: '',
    due_date: today,
    amount: '',
    description: '',
    notes: '',
  };
}

/**
 * Build the edit form from a loaded bill (the response carries the accounts as objects).
 *
 * @param {object} bill - The bill response.
 * @returns {object} The form fields.
 */
export function billFieldsFromBill(bill) {
  return {
    provider_account_id: String(bill.provider_account?.id ?? ''),
    paying_account_id: String(bill.paying_account?.id ?? ''),
    due_date: bill.due_date ?? '',
    amount: bill.amount ?? '',
    description: bill.description ?? '',
    notes: bill.notes ?? '',
  };
}

/**
 * Find a provider by its id (as typed in the form).
 *
 * @param {Array<object>|null} providers - The providers.
 * @param {string} id - The provider id.
 * @returns {object|undefined} The provider.
 */
export function findProvider(providers, id) {
  return (providers ?? []).find((provider) => String(provider.id) === String(id));
}

/**
 * Build the provider select options.
 *
 * @param {Array<object>|null} providers - The non-archived providers.
 * @returns {Array<Array<string>>} The `[value, label]` pairs.
 */
export function providerOptions(providers) {
  return (providers ?? []).map((provider) => [String(provider.id), provider.name]);
}

/**
 * Apply a field change; a provider change clears a paying account in another currency.
 *
 * @param {object} fields - The current form fields.
 * @param {string} name - The changed field.
 * @param {*} value - The new value.
 * @param {{providers: Array<object>, accounts: Array<object>}} lists - The loaded providers
 *   and regular accounts.
 * @returns {object} The next form fields.
 */
export function withBillFieldChange(fields, name, value, { providers, accounts }) {
  const next = { ...fields, [name]: value };

  if (name !== 'provider_account_id' || next.paying_account_id === '') {
    return next;
  }

  const currency = findProvider(providers, value)?.currency;
  const offered = payingAccountOptions(accounts, currency).some(([id]) => id === next.paying_account_id);

  return offered ? next : { ...next, paying_account_id: '' };
}

/**
 * Validate a required positive id (a select value).
 *
 * @param {string} raw - The raw value.
 * @param {string} message - The error when missing.
 * @returns {{error: (string|null), value: (number|null)}} The error, or the id.
 */
function idEntry(raw, message) {
  const value = Number(text(raw));

  return Number.isInteger(value) && value > 0 ? { error: null, value } : { error: message, value: null };
}

/**
 * Validate a text field: trimmed, optionally required, bounded.
 *
 * @param {string} raw - The raw value.
 * @param {{label: string, max: number, required: boolean}} rules - The label, the length
 *   bound and whether it is required.
 * @returns {{error: (string|null), value: (string|null)}} The error, or the value (`null` when
 *   blank).
 */
function textEntry(raw, { label, max, required }) {
  const value = text(raw);

  if (!value) {
    return { error: required ? `${label} is required` : null, value: null };
  }

  return value.length > max ? { error: `${label} must be at most ${max} characters`, value: null } : { error: null, value };
}

/**
 * Validate the amount: required, > 0, in the provider's currency (decimals and 10¹³ bound).
 *
 * @param {string} raw - The raw value.
 * @param {string|undefined} currency - The provider's currency.
 * @returns {{error: (string|null), value: (string|null)}} The error, or the decimal string.
 */
function amountEntry(raw, currency) {
  if (!text(raw)) {
    return { error: 'Amount is required', value: null };
  }

  const parsed = parseAmount(raw, { currency: currency || undefined });

  return { error: parsed.error ?? null, value: parsed.value ?? null };
}

/**
 * Validate the bill form and build the body.
 *
 * @description Provider, paying account and due date are required (past dates allowed); the
 * amount is > 0 in the provider's currency; the description is trimmed and required (≤ 255);
 * the notes are optional (≤ 2000, blank → `null`). Owner fields are never part of the body.
 * @param {object} fields - The form fields.
 * @param {{currency: string}} [options] - The selected provider's currency.
 * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
 */
export function validateBillFields(fields, { currency } = {}) {
  const provider = idEntry(fields.provider_account_id, 'Choose the provider');
  const paying = idEntry(fields.paying_account_id, 'Choose the paying account');
  const dueDate = text(fields.due_date);
  const amount = amountEntry(fields.amount, currency);
  const description = textEntry(fields.description, { label: 'Description', max: DESCRIPTION_MAX_LENGTH, required: true });
  const notes = textEntry(fields.notes, { label: 'Notes', max: NOTES_MAX_LENGTH, required: false });
  const errors = Object.fromEntries([
    ['provider_account_id', provider.error],
    ['paying_account_id', paying.error],
    ['due_date', DATE_PATTERN.test(dueDate) ? null : 'Enter the due date'],
    ['amount', amount.error],
    ['description', description.error],
    ['notes', notes.error],
  ].filter(([, error]) => error));

  if (Object.keys(errors).length) {
    return { errors, body: null };
  }

  return {
    errors,
    body: {
      provider_account_id: provider.value,
      paying_account_id: paying.value,
      due_date: dueDate,
      amount: amount.value,
      description: description.value,
      notes: notes.value,
    },
  };
}

/**
 * Keep only what changed against the loaded bill.
 *
 * @param {object} body - The validated body.
 * @param {object} original - The body built from the loaded bill.
 * @returns {object} The PATCH body.
 */
export function changedBillFields(body, original) {
  return changedFields(body, original);
}
