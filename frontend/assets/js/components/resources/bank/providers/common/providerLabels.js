import { formatInstalment } from '../../common/rates.js';

/** Shown for an unset value in the Providers pages. */
export const EMPTY_MARK = '—';

/** The charge frequency select options, as `[value, label]` pairs in display order. */
export const FREQUENCY_OPTIONS = [['monthly', 'Monthly'], ['yearly', 'Yearly']];

/** The provider form's labels for the shared bank fields. */
export const PROVIDER_FIELD_LABELS = {
  bankName: 'Provider',
  branch: 'Branch',
  accountNumber: 'Customer / contract number',
};

/**
 * Format a provider's expected amount with its charge frequency (decided in #55).
 *
 * @param {string|null} amount - The `expected_amount` decimal string.
 * @param {string|null} frequency - The `charge_frequency` (`monthly` | `yearly`).
 * @param {string} currency - The account's ISO 4217 currency.
 * @returns {string} E.g. "R$ 200,00 / month" or "… / year", or "—" when no amount is set.
 */
export function formatExpected(amount, frequency, currency) {
  return formatInstalment(amount, frequency, currency) || EMPTY_MARK;
}

/**
 * Read the for-accountant marker of a provider.
 *
 * @param {boolean|null} forAccountant - The `for_accountant` flag.
 * @returns {string} "Yes" for a business expense, "—" otherwise.
 */
export function forAccountantLabel(forAccountant) {
  return forAccountant ? 'Yes' : EMPTY_MARK;
}
