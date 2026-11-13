import { localToday } from '../../dates.js';
import { text } from './nestedFields.js';

/** The schedule fields shared by the debt and provider forms (nested with the type's fields). */
export const SCHEDULE_FIELD_NAMES = ['bills_from', 'show_in_calendar', 'paying_account_id'];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Build the empty schedule fields: no start date, shown in the Calendar, no default paying
 * account.
 *
 * @returns {{bills_from: string, show_in_calendar: boolean, paying_account_id: string}} The
 *   form fields.
 */
export function emptyScheduleFields() {
  return { bills_from: '', show_in_calendar: true, paying_account_id: '' };
}

/**
 * Build the schedule form fields of a loaded account's nested object (`debt` /
 * `provider_expense`); the response carries `paying_account: {id, name}`, never a raw id.
 *
 * @param {object|null} details - The nested object of the account response.
 * @returns {{bills_from: string, show_in_calendar: boolean, paying_account_id: string}} The
 *   form fields.
 */
export function scheduleFieldsFromAccount(details) {
  const source = details ?? {};

  return {
    bills_from: source.bills_from ?? '',
    show_in_calendar: source.show_in_calendar ?? true,
    paying_account_id: String(source.paying_account?.id ?? ''),
  };
}

/**
 * Validate the schedule fields and build their body values: blanks become `null`, the paying
 * account id a number and Show in Calendar a boolean.
 *
 * @param {object} fields - The form fields.
 * @returns {{errors: Array<Array>, values: object}} Error entries and the body values.
 */
export function validateScheduleFields(fields) {
  const billsFrom = text(fields.bills_from);
  const payingAccountId = text(fields.paying_account_id);
  const dateError = billsFrom && !DATE_PATTERN.test(billsFrom) ? 'Enter a valid date' : null;

  return {
    errors: [['bills_from', dateError]],
    values: {
      bills_from: billsFrom || null,
      show_in_calendar: Boolean(fields.show_in_calendar),
      paying_account_id: payingAccountId ? Number(payingAccountId) : null,
    },
  };
}

/**
 * Apply a field change, filling Bills from with today the first time a due day is entered.
 *
 * @param {object} fields - The current form fields.
 * @param {string} name - The changed field.
 * @param {*} value - The new value.
 * @param {string} today - Local today, `YYYY-MM-DD`.
 * @returns {object} The next form fields.
 */
export function withBillsFromAutofill(fields, name, value, today) {
  const next = { ...fields, [name]: value };
  const autofill = name === 'due_day' && text(value) !== '' && fields.bills_from === '';

  return autofill ? { ...next, bills_from: today } : next;
}

/**
 * Build the Default paying account options: the regular accounts in the given currency.
 *
 * @param {Array<object>|null} accounts - The owner's non-archived accounts.
 * @param {string} currency - The account's currency.
 * @returns {Array<Array<string>>} The `[value, label]` pairs.
 */
export function payingAccountOptions(accounts, currency) {
  return (accounts ?? [])
    .filter((account) => (account.type ?? 'regular') === 'regular' && account.currency === currency)
    .map((account) => [String(account.id), account.name]);
}

/**
 * Clear the selected default paying account when it is not offered in the fields' currency.
 *
 * @param {object} fields - The form fields (with the new currency).
 * @param {Array<object>|null} accounts - The owner's non-archived accounts.
 * @returns {object} The fields, with `paying_account_id` cleared when it no longer matches.
 */
export function clearMismatchedPayingAccount(fields, accounts) {
  const selected = String(fields.paying_account_id ?? '');
  const offered = payingAccountOptions(accounts, fields.currency).some(([value]) => value === selected);

  return selected === '' || offered ? fields : { ...fields, paying_account_id: '' };
}

/**
 * Build the schedule-aware field handlers of a debt / provider form.
 *
 * @description `onFieldChange` fills Bills from with today on the first due day entry;
 * `onCurrencyChange` (create pages) also clears a default paying account that does not match
 * the new currency.
 * @param {Function} setFields - React state setter for the form fields.
 * @param {Array<object>|null} accounts - The owner's non-archived regular accounts.
 * @param {Function} [today] - Returns local today (injectable for specs).
 * @returns {{onFieldChange: Function, onCurrencyChange: Function}} The handlers.
 */
export function buildScheduleHandlers(setFields, accounts, today = localToday) {
  return {
    onFieldChange: (event) => {
      const { name, value } = event.target;

      setFields((fields) => withBillsFromAutofill(fields, name, value, today()));
    },
    onCurrencyChange: (currency) => setFields(
      (fields) => clearMismatchedPayingAccount({ ...fields, currency }, accounts),
    ),
  };
}
