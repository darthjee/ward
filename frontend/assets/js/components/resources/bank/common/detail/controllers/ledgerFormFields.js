import { fromSignedAmount, parseAmount, toSignedAmount } from '../../amounts.js';
import { isAfterLocalToday, localToday } from '../../dates.js';

/** Largest transaction description accepted (mirrors the backend). */
export const DESCRIPTION_MAX_LENGTH = 255;

/** Question asked before discarding an unsaved inline form. */
export const DISCARD_QUESTION = 'Discard the unsaved transaction changes?';

/**
 * Build the empty inline form values: local today, **Out**, no amount.
 *
 * @param {string} [today] - Local today, `YYYY-MM-DD`.
 * @returns {object} The form values.
 */
export function emptyLedgerValues(today = localToday()) {
  return {
    date: today, direction: 'out', amount: '', description: '', notes: '',
  };
}

/**
 * Load a transaction into the form: the toggle follows the stored sign and the amount field
 * shows the absolute value.
 *
 * @param {object} transaction - The ledger row.
 * @returns {object} The form values.
 */
export function valuesFromTransaction(transaction) {
  const { direction, value } = fromSignedAmount(transaction.amount);

  return {
    date: transaction.date,
    direction,
    amount: value,
    description: transaction.description ?? '',
    notes: transaction.notes ?? '',
  };
}

/**
 * Validate the description.
 *
 * @param {string} description - The raw description.
 * @returns {string|null} The error, or `null`.
 */
function descriptionError(description) {
  const trimmed = String(description ?? '').trim();

  if (!trimmed) {
    return 'Description is required';
  }

  return trimmed.length > DESCRIPTION_MAX_LENGTH
    ? `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`
    : null;
}

/**
 * Validate the date: required, not after local today.
 *
 * @param {string} date - The `YYYY-MM-DD` date.
 * @param {Date} now - The current instant.
 * @returns {string|null} The error, or `null`.
 */
function dateError(date, now) {
  if (!date) {
    return 'Date is required';
  }

  return isAfterLocalToday(date, now) ? 'Date cannot be in the future' : null;
}

/**
 * Build the notes entry of the body: on edit a blank clears the notes (`null`); on create a
 * blank is simply not sent.
 *
 * @param {string} notes - The raw notes.
 * @param {boolean} editing - Whether a transaction is being edited.
 * @returns {string|null|undefined} The notes value.
 */
function notesValue(notes, editing) {
  const trimmed = String(notes ?? '').trim();

  if (trimmed) {
    return trimmed;
  }

  return editing ? null : undefined;
}

/**
 * Validate the inline form and build the transaction body.
 *
 * @description Client checks before submit (the backend's 400 stays the authority): the
 * description is required, the date must not be after local today, and the amount is positive,
 * non-zero, within the currency's decimals and the 10¹³ minor-unit cap. The sent amount is
 * signed by the Out / In toggle.
 * @param {object} values - The form values.
 * @param {{currency: string, editing: boolean, now: Date}} options - The account currency,
 *   whether a transaction is being edited, and the current instant.
 * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
 */
export function validateLedgerValues(values, { currency, editing = false, now = new Date() }) {
  const amount = parseAmount(values.amount, { currency, allowNegative: false, allowZero: false });
  const errors = Object.fromEntries([
    ['date', dateError(values.date, now)],
    ['amount', amount.error ?? null],
    ['description', descriptionError(values.description)],
  ].filter(([, error]) => error));

  if (Object.keys(errors).length) {
    return { errors, body: null };
  }

  const body = {
    date: values.date,
    amount: toSignedAmount(values.direction, amount.value),
    description: values.description.trim(),
  };
  const notes = notesValue(values.notes, editing);

  return { errors, body: notes === undefined ? body : { ...body, notes } };
}

/**
 * Check whether the form differs from its baseline.
 *
 * @param {object} values - The current values.
 * @param {object} baseline - The values the form was opened with.
 * @returns {boolean} True when something changed.
 */
export function isDirty(values, baseline) {
  const before = new Map(Object.entries(baseline ?? {}));

  return Object.entries(values ?? {}).some(([key, value]) => before.get(key) !== value);
}

/**
 * Ask the browser to confirm, SSR-safe.
 *
 * @param {string} question - The question.
 * @returns {boolean} The answer (`true` outside the browser).
 */
function browserConfirm(question) {
  return typeof window === 'undefined' || window.confirm(question);
}

/**
 * Decide whether an unsaved inline form may be discarded.
 *
 * @param {boolean} dirty - Whether the form has unsaved changes.
 * @param {Function} [confirm] - Asks the user (default `window.confirm`; injected for specs).
 * @returns {boolean} True when there is nothing to lose or the user confirmed.
 */
export function confirmDiscard(dirty, confirm = browserConfirm) {
  return !dirty || Boolean(confirm(DISCARD_QUESTION));
}
