import { parseAmount } from '../../amounts.js';
import { isAfterLocalToday, localToday } from '../../dates.js';

/** Largest account name accepted (mirrors the backend). */
export const NAME_MAX_LENGTH = 255;

const TEXT_FIELDS = ['bank_name', 'branch', 'account_number', 'notes'];

/**
 * Build the empty create form: opening date defaults to local today, opening balance to 0.
 *
 * @param {string} [currency] - The default currency (`''` when unknown).
 * @param {string} [today] - Local today, `YYYY-MM-DD`.
 * @returns {object} The form fields.
 */
export function emptyAccountFields(currency = '', today = localToday()) {
  return {
    name: '',
    bank_name: '',
    branch: '',
    account_number: '',
    currency,
    opening_date: today,
    opening_balance: '0',
    notes: '',
  };
}

/**
 * Build the edit form from a loaded account (full account number).
 *
 * @param {object} account - The account response.
 * @returns {object} The form fields.
 */
export function fieldsFromAccount(account) {
  return {
    name: account.name ?? '',
    bank_name: account.bank_name ?? '',
    branch: account.branch ?? '',
    account_number: account.account_number ?? '',
    currency: account.currency ?? '',
    opening_date: account.opening_date ?? '',
    opening_balance: account.opening_balance ?? '0',
    notes: account.notes ?? '',
  };
}

/**
 * Trim a free-text value, `null` when blank (the backend stores blanks as `null`).
 *
 * @param {string} value - The raw value.
 * @returns {string|null} The trimmed value, or `null`.
 */
function textOrNull(value) {
  const trimmed = String(value ?? '').trim();

  return trimmed === '' ? null : trimmed;
}

/**
 * Validate the name.
 *
 * @param {string} name - The raw name.
 * @returns {string|null} The error, or `null`.
 */
function nameError(name) {
  const trimmed = String(name ?? '').trim();

  if (!trimmed) {
    return 'Name is required';
  }

  return trimmed.length > NAME_MAX_LENGTH ? `Name must be at most ${NAME_MAX_LENGTH} characters` : null;
}

/**
 * Validate the opening date: required, not after local today.
 *
 * @param {string} date - The `YYYY-MM-DD` date.
 * @param {Date} now - The current instant.
 * @param {string} label - The date's label in the messages (e.g. "Start date").
 * @returns {string|null} The error, or `null`.
 */
function openingDateError(date, now, label) {
  if (!date) {
    return `${label} is required`;
  }

  return isAfterLocalToday(date, now) ? `${label} cannot be in the future` : null;
}

/**
 * Collect the non-null errors into a map.
 *
 * @param {Array<Array>} entries - `[field, error|null]` pairs.
 * @returns {object} The field errors.
 */
function collectErrors(entries) {
  return Object.fromEntries(entries.filter(([, error]) => error));
}

/**
 * Validate an archived account's form: only the name, and the body carries only `name`.
 *
 * @param {object} fields - The form fields.
 * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
 */
function validateNameOnly(fields) {
  const errors = collectErrors([['name', nameError(fields.name)]]);

  return { errors, body: Object.keys(errors).length ? null : { name: fields.name.trim() } };
}

/**
 * Validate the form and build the `snake_case` request body.
 *
 * @description With `nameOnly` (an archived account: only a rename is allowed) the body carries
 * **only** `name`. Otherwise the currency is required, the opening date must not be after local
 * today, and the opening balance accepts an optional leading `-` and zero, within the currency's
 * decimals. `dateLabel` names the opening date in its errors (default "Opening date"; e.g.
 * Investments' "Start date").
 * @param {object} fields - The form fields.
 * @param {{nameOnly: boolean, now: Date, dateLabel: string}} [options] - Validation options.
 * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
 */
export function validateAccountFields(fields, { nameOnly = false, now = new Date(), dateLabel = 'Opening date' } = {}) {
  if (nameOnly) {
    return validateNameOnly(fields);
  }

  const balance = parseAmount(fields.opening_balance, {
    currency: fields.currency || undefined, allowNegative: true, allowZero: true,
  });
  const errors = collectErrors([
    ['name', nameError(fields.name)],
    ['currency', fields.currency ? null : 'Choose a currency'],
    ['opening_date', openingDateError(fields.opening_date, now, dateLabel)],
    ['opening_balance', balance.error ?? null],
  ]);

  if (Object.keys(errors).length) {
    return { errors, body: null };
  }

  const source = new Map(Object.entries(fields));

  return {
    errors,
    body: {
      name: fields.name.trim(),
      ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, textOrNull(source.get(field))])),
      currency: fields.currency,
      opening_date: fields.opening_date,
      opening_balance: balance.value,
    },
  };
}

/**
 * Keep only the body entries that differ from the original account.
 *
 * @param {object} body - The validated body.
 * @param {object} original - The body built from the loaded account.
 * @returns {object} The changed entries.
 */
export function changedFields(body, original) {
  const before = new Map(Object.entries(original ?? {}));

  return Object.fromEntries(Object.entries(body).filter(([key, value]) => before.get(key) !== value));
}
