import { localToday } from '../../../common/dates.js';
import { payingAccountOptions, withBillsFromAutofill } from '../../../common/form/controllers/scheduleFields.js';

export {
  DESCRIPTION_MAX_LENGTH, NOTES_MAX_LENGTH, KIND_OPTIONS, validateBillFields, changedBillFields,
} from './billFormValidation.js';

/**
 * Read a response value as form text.
 *
 * @param {*} value - The response value.
 * @returns {string} The value as a string, `''` when null or missing.
 */
function asText(value) {
  return String(value ?? '');
}

/**
 * Build the empty bill create form: a one-off bill, the pre-selected provider (if any), due
 * today.
 *
 * @param {string} [providerId] - The provider pre-selected by `?provider=:id`.
 * @param {string} [today] - Local today, `YYYY-MM-DD`.
 * @returns {object} The form fields.
 */
export function emptyBillFields(providerId = '', today = localToday()) {
  return {
    kind: 'one_off',
    provider_account_id: providerId,
    paying_account_id: '',
    due_date: today,
    expected_amount: '',
    description: '',
    notes: '',
    charge_frequency: 'monthly',
    due_day: '',
    due_month: '',
    bills_from: '',
    show_in_calendar: true,
  };
}

/**
 * Build the edit form from a loaded provider bill (the response carries raw ids).
 *
 * @param {object} bill - The `provider-bills` response.
 * @returns {object} The form fields.
 */
export function billFieldsFromBill(bill) {
  return {
    kind: bill.kind ?? 'one_off',
    provider_account_id: asText(bill.provider_account_id),
    paying_account_id: asText(bill.paying_account_id),
    due_date: asText(bill.due_date),
    expected_amount: asText(bill.expected_amount),
    description: asText(bill.description),
    notes: asText(bill.notes),
    charge_frequency: bill.charge_frequency ?? 'monthly',
    due_day: asText(bill.due_day),
    due_month: asText(bill.due_month),
    bills_from: asText(bill.bills_from),
    show_in_calendar: bill.show_in_calendar ?? true,
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
  const next = withBillsFromAutofill(fields, name, value, localToday());

  if (name !== 'provider_account_id' || next.paying_account_id === '') {
    return next;
  }

  const currency = findProvider(providers, value)?.currency;
  const offered = payingAccountOptions(accounts, currency).some(([id]) => id === next.paying_account_id);

  return offered ? next : { ...next, paying_account_id: '' };
}
