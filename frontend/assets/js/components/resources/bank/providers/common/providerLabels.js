import { formatInstalment } from '../../common/rates.js';

/** Shown for an unset value in the Providers pages. */
export const EMPTY_MARK = '—';

/** The charge frequency select options, as `[value, label]` pairs in display order. */
export const FREQUENCY_OPTIONS = [['monthly', 'Monthly'], ['yearly', 'Yearly']];

/** Display label of each charge frequency. */
const FREQUENCY_LABELS = new Map(FREQUENCY_OPTIONS);

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
 * Tell whether a `bills_summary` sum adds nothing to the Bills cell.
 *
 * @param {string|number|null|undefined} value - A `monthly` / `yearly` sum.
 * @returns {boolean} True when the sum is unset or zero (e.g. `"0.00"`).
 */
function isZeroSum(value) {
  return value === null || value === undefined || value === '' || Number(value) === 0;
}

/**
 * Split a provider's `bills_summary` into the parts of the provider list's Bills cell.
 *
 * @param {{count: number, monthly: string|null, yearly: string|null}|null|undefined} summary -
 *   The provider's `bills_summary` from the list payload.
 * @param {string} currency - The provider's ISO 4217 currency.
 * @returns {string[]|null} E.g. ["3 bills", "R$ 250,00 / month", "R$ 1.200,00 / year"];
 *   [EMPTY_MARK] when the provider has no bills; null when the summary is missing.
 */
export function billsSummaryParts(summary, currency) {
  if (summary === null || summary === undefined) return null;
  if (!summary.count) return [EMPTY_MARK];

  const { count, monthly, yearly } = summary;
  const parts = [`${count} ${count === 1 ? 'bill' : 'bills'}`];

  if (!isZeroSum(monthly)) parts.push(formatInstalment(monthly, 'monthly', currency));
  if (!isZeroSum(yearly)) parts.push(formatInstalment(yearly, 'yearly', currency));

  return parts;
}

/**
 * Format a provider's `bills_summary` as the full text of the provider list's Bills cell.
 *
 * @param {{count: number, monthly: string|null, yearly: string|null}|null|undefined} summary -
 *   The provider's `bills_summary` from the list payload.
 * @param {string} currency - The provider's ISO 4217 currency.
 * @returns {string} E.g. "3 bills · R$ 250,00 / month + R$ 1.200,00 / year"; "—" without
 *   bills; `''` when the summary is missing.
 */
export function formatBillsSummary(summary, currency) {
  const parts = billsSummaryParts(summary, currency);

  if (!parts) return '';

  const [first, ...sums] = parts;

  return sums.length ? `${first} · ${sums.join(' + ')}` : first;
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

/**
 * Read the display label of a charge frequency.
 *
 * @param {string|null} frequency - The `charge_frequency` (`monthly` | `yearly`).
 * @returns {string} "Monthly" / "Yearly", or `''` when unset or unknown.
 */
export function frequencyLabel(frequency) {
  return FREQUENCY_LABELS.get(frequency) ?? '';
}
