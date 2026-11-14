import { parseAmount } from '../../common/amounts.js';
import { isAfterLocalToday, localToday } from '../../common/dates.js';

/**
 * Build the initial fields of the Pay dialog.
 *
 * @description The amount starts at `expected_amount` (empty without one); paid on at the local
 * today; the paying account at the occurrence's default when that account is among the offered
 * options (the default carries no archived flag, so one that is not offered counts as archived
 * or unusable), otherwise empty and required; the charge box checked.
 * @param {object} occ - The occurrence.
 * @param {Array<Array<string>>} payingOptions - The offered `[value, label]` paying accounts.
 * @param {string} [today] - The local today, `YYYY-MM-DD`.
 * @returns {{amount: string, paid_on: string, paying_account_id: string, record_charge: boolean}}
 *   The fields.
 */
export function initialPayFields(occ, payingOptions, today = localToday()) {
  const defaultId = occ.default_paying_account ? String(occ.default_paying_account.id) : '';
  const offered = payingOptions.some(([value]) => value === defaultId);

  return {
    amount: occ.expected_amount ?? '',
    paid_on: today,
    paying_account_id: offered ? defaultId : '',
    record_charge: true,
  };
}

/**
 * Validate the amount: required and positive in the occurrence's currency.
 *
 * @param {string} raw - The raw value.
 * @param {string} currency - The occurrence's currency.
 * @returns {{error: (string|null), value: (string|null)}} The error, or the decimal string.
 */
function amountEntry(raw, currency) {
  if (!String(raw ?? '').trim()) {
    return { error: 'Amount is required', value: null };
  }

  const parsed = parseAmount(raw, { currency });

  return { error: parsed.error ?? null, value: parsed.value ?? null };
}

/**
 * Validate the paid-on date: required and not after the local today.
 *
 * @param {string} raw - The raw value.
 * @param {Date} now - The current instant.
 * @returns {string|null} The error, or `null`.
 */
function dateError(raw, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw ?? ''))) {
    return 'Enter the date paid';
  }

  return isAfterLocalToday(raw, now) ? 'Date cannot be in the future' : null;
}

/**
 * Validate the Pay dialog fields and build the payment fields.
 *
 * @param {object} fields - The dialog fields.
 * @param {object} occ - The occurrence.
 * @param {Date} [now] - The current instant (injectable for specs).
 * @returns {{errors: object, values: (object|null)}} The field errors and, when valid, the
 *   values (`paid_on`, `amount`, `paying_account_id`, `record_charge`).
 */
export function validatePayFields(fields, occ, now = new Date()) {
  const amount = amountEntry(fields.amount, occ.currency);
  const payingId = Number(fields.paying_account_id);
  const errors = Object.fromEntries([
    ['amount', amount.error],
    ['paid_on', dateError(fields.paid_on, now)],
    ['paying_account_id', Number.isInteger(payingId) && payingId > 0 ? null : 'Choose the paying account'],
  ].filter(([, error]) => error));

  if (Object.keys(errors).length) {
    return { errors, values: null };
  }

  return {
    errors,
    values: {
      paid_on: fields.paid_on,
      amount: amount.value,
      paying_account_id: payingId,
      record_charge: Boolean(fields.record_charge),
    },
  };
}
