import { parseAmount } from '../../../common/amounts.js';
import { changedFields } from '../../../common/form/controllers/accountFormFields.js';
import { validateScheduleFields } from '../../../common/form/controllers/scheduleFields.js';
import { integerIn, text } from '../../../common/form/controllers/nestedFields.js';

/** Largest bill description accepted (mirrors the backend). */
export const DESCRIPTION_MAX_LENGTH = 255;

/** Largest bill notes accepted (mirrors the backend). */
export const NOTES_MAX_LENGTH = 2000;

/** The bill kinds, as `[value, label]` pairs in display order. */
export const KIND_OPTIONS = [['one_off', 'One-off'], ['recurring', 'Recurring']];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
 * Validate the expected amount: > 0, in the provider's currency (decimals and 10¹³ bound).
 *
 * @param {string} raw - The raw value.
 * @param {{currency: (string|undefined), required: boolean}} rules - The provider's currency
 *   and whether the amount is required (one-off bills).
 * @returns {{error: (string|null), value: (string|null)}} The error, or the decimal string
 *   (`null` when blank and optional).
 */
function amountEntry(raw, { currency, required }) {
  if (!text(raw)) {
    return { error: required ? 'Amount is required' : null, value: null };
  }

  const parsed = parseAmount(raw, { currency: currency || undefined });

  return { error: parsed.error ?? null, value: parsed.value ?? null };
}

/**
 * Build the entries shared by both kinds: provider, description, notes and expected amount.
 *
 * @param {object} fields - The form fields.
 * @param {{currency: (string|undefined), required: boolean}} amountRules - Amount rules.
 * @returns {{errors: Array<Array>, values: object}} Error entries and body values.
 */
function commonEntries(fields, amountRules) {
  const provider = idEntry(fields.provider_account_id, 'Choose the provider');
  const amount = amountEntry(fields.expected_amount, amountRules);
  const description = textEntry(fields.description, { label: 'Description', max: DESCRIPTION_MAX_LENGTH, required: true });
  const notes = textEntry(fields.notes, { label: 'Notes', max: NOTES_MAX_LENGTH, required: false });

  return {
    errors: [
      ['provider_account_id', provider.error],
      ['expected_amount', amount.error],
      ['description', description.error],
      ['notes', notes.error],
    ],
    values: {
      provider_account_id: provider.value,
      expected_amount: amount.value,
      description: description.value,
      notes: notes.value,
    },
  };
}

/**
 * Build the entries of a one-off bill: required paying account and due date.
 *
 * @param {object} fields - The form fields.
 * @returns {{errors: Array<Array>, values: object}} Error entries and body values.
 */
function oneOffEntries(fields) {
  const paying = idEntry(fields.paying_account_id, 'Choose the paying account');
  const dueDate = text(fields.due_date);

  return {
    errors: [
      ['paying_account_id', paying.error],
      ['due_date', DATE_PATTERN.test(dueDate) ? null : 'Enter the due date'],
    ],
    values: { paying_account_id: paying.value, due_date: dueDate },
  };
}

/**
 * Build the entries of a recurring bill: frequency, due day (1–31), due month (yearly only) and
 * the optional schedule fields (Bills from, Show in Calendar, paying account).
 *
 * @param {object} fields - The form fields.
 * @returns {{errors: Array<Array>, values: object}} Error entries and body values.
 */
function recurringEntries(fields) {
  const yearly = fields.charge_frequency === 'yearly';
  const day = integerIn(fields.due_day, [1, 31], 'Due day must be between 1 and 31');
  const month = integerIn(fields.due_month, [1, 12], 'Due month must be between 1 and 12');
  const schedule = validateScheduleFields(fields);

  return {
    errors: [
      ['charge_frequency', fields.charge_frequency ? null : 'Choose the frequency'],
      ['due_day', text(fields.due_day) ? day.error : 'Due day is required'],
      ['due_month', yearly && !text(fields.due_month) ? 'Due month is required' : month.error],
      ...schedule.errors,
    ],
    values: {
      charge_frequency: fields.charge_frequency,
      due_day: day.value,
      due_month: yearly ? month.value : null,
      ...schedule.values,
    },
  };
}

/**
 * Validate the bill form and build the body of its kind.
 *
 * @description A one-off bill requires the provider, paying account, due date, amount (> 0 in
 * the provider's currency) and description. A recurring bill requires the provider,
 * description, frequency and due day (1–31), plus the due month when yearly; its amount, Bills
 * from and paying account are optional. The description is trimmed (≤ 255); the notes are
 * optional (≤ 2000, blank → `null`). Only the fields of the selected kind are in the body.
 * @param {object} fields - The form fields.
 * @param {{currency: string}} [options] - The selected provider's currency.
 * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
 */
export function validateBillFields(fields, { currency } = {}) {
  const recurring = fields.kind === 'recurring';
  const common = commonEntries(fields, { currency, required: !recurring });
  const specific = recurring ? recurringEntries(fields) : oneOffEntries(fields);
  const errors = Object.fromEntries([...common.errors, ...specific.errors].filter(([, error]) => error));

  if (Object.keys(errors).length) {
    return { errors, body: null };
  }

  return { errors, body: { kind: fields.kind, ...common.values, ...specific.values } };
}

/**
 * Keep only what changed against the loaded bill.
 *
 * @description The `kind` is never sent on an edit, nor the provider of a recurring bill.
 * @param {object} body - The validated body.
 * @param {object} original - The body built from the loaded bill.
 * @returns {object} The PATCH body.
 */
export function changedBillFields(body, original) {
  const changed = changedFields(body, original);
  const dropped = new Set(['kind']);

  if (body.kind === 'recurring') {
    dropped.add('provider_account_id');
  }

  return Object.fromEntries(Object.entries(changed).filter(([name]) => !dropped.has(name)));
}
