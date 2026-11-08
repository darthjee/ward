/** Largest accepted `|amount|`, in minor units (10¹³). */
export const MAX_ABS_MINOR_UNITS = 10n ** 13n;

const AMOUNT_PATTERN = /^(-?)([0-9]+)(?:[.,]([0-9]*))?$/;

/**
 * Read a currency's number of decimal places from `Intl`.
 *
 * @param {string} currency - ISO 4217 code.
 * @returns {number} The currency's maximum fraction digits (BRL 2, JPY 0, BHD 3).
 */
export function currencyDigits(currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency })
    .resolvedOptions().maximumFractionDigits;
}

/**
 * Convert an absolute decimal amount into minor units, without float arithmetic.
 *
 * @param {string} integer - The integer digits.
 * @param {string} fraction - The fraction digits (at most `digits` long).
 * @param {number} digits - The currency's decimal places.
 * @returns {bigint} The absolute amount in minor units.
 */
function minorUnits(integer, fraction, digits) {
  return BigInt(`${integer}${fraction.padEnd(digits, '0')}`);
}

/**
 * Check the parsed parts of an amount against the options.
 *
 * @param {Array<string>} parts - `[sign, integer, fraction]` from the pattern.
 * @param {{digits: number, allowNegative: boolean, allowZero: boolean}} rules - The rules.
 * @returns {string|null} An error message, or `null` when valid.
 */
function amountError([sign, integer, fraction], { digits, allowNegative, allowZero }) {
  if (sign && !allowNegative) {
    return 'Enter a positive amount.';
  }

  if (fraction.length > digits) {
    return digits === 0
      ? 'This currency does not accept decimals.'
      : `Use at most ${digits} decimal places.`;
  }

  const minor = minorUnits(integer, fraction, digits);

  if (minor === 0n && !allowZero) {
    return 'The amount must not be zero.';
  }

  return minor > MAX_ABS_MINOR_UNITS ? 'The amount is too large.' : null;
}

/**
 * Parse a typed amount into the decimal string sent to the API.
 *
 * @description Accepts digits with one optional decimal separator, either `.` or `,` (thousands
 * separators are rejected), an optional leading `-` only when `allowNegative`, at most the
 * currency's decimal places, a zero only when `allowZero`, and `|amount|` up to 10¹³ minor
 * units. The value never goes through a float; `,` is normalised to `.`.
 * @param {string} input - The raw input.
 * @param {{currency: string, allowNegative: boolean, allowZero: boolean}} options - The
 *   account's currency and the sign / zero rules.
 * @returns {{value: string}|{error: string}} The normalised decimal string, or an error.
 */
export function parseAmount(input, { currency, allowNegative = false, allowZero = false } = {}) {
  const match = AMOUNT_PATTERN.exec(String(input ?? '').trim());

  if (!match) {
    return { error: 'Enter a number, using . or , for decimals and no thousands separators.' };
  }

  const [, sign, integer, fraction = ''] = match;
  const digits = currency ? currencyDigits(currency) : fraction.length;
  const error = amountError([sign, integer, fraction], { digits, allowNegative, allowZero });

  if (error) {
    return { error };
  }

  return { value: fraction ? `${sign}${integer}.${fraction}` : `${sign}${integer}` };
}

/**
 * Map a direction and an absolute amount to the signed amount sent to the API.
 *
 * @param {string} direction - `'out'` or `'in'`.
 * @param {string} value - The absolute decimal string.
 * @returns {string} `-<value>` for `out`, `<value>` for `in`.
 */
export function toSignedAmount(direction, value) {
  return direction === 'out' ? `-${value}` : value;
}

/**
 * Split a stored signed amount into a direction and an absolute value.
 *
 * @param {string} amount - The API's signed decimal string.
 * @returns {{direction: string, value: string}} `out` for a leading `-`, `in` otherwise, with
 *   the absolute value.
 */
export function fromSignedAmount(amount) {
  const text = String(amount ?? '');

  return text.startsWith('-')
    ? { direction: 'out', value: text.slice(1) }
    : { direction: 'in', value: text };
}

/**
 * Negate a decimal string without going through `Number` (no rounding): `'10.00'` → `'-10.00'`,
 * `'-3'` → `'3'`. Blank and zero values are returned unchanged (never `-0`).
 *
 * @param {string|null} amount - The decimal string (API value or user input).
 * @returns {string} The negated decimal string (`''` for a blank value).
 */
export function negateAmount(amount) {
  const text = String(amount ?? '').trim();

  if (text === '' || /^[-+]?0*(\.0*)?$/.test(text)) {
    return text;
  }

  return text.startsWith('-') ? text.slice(1) : `-${text.replace(/^\+/, '')}`;
}

/**
 * Format an API decimal string as money in the account's currency.
 *
 * @description Uses the browser's default locale (display preferences are #65). Amounts are
 * bounded by the 10¹³ minor-unit cap, well within `Number`'s safe range.
 * @param {string} decimalString - The API's decimal string.
 * @param {string} currency - ISO 4217 code.
 * @returns {string} The formatted amount (empty when no amount).
 */
export function formatMoney(decimalString, currency) {
  if (decimalString === null || decimalString === undefined || decimalString === '') {
    return '';
  }

  return new Intl.NumberFormat(undefined, { style: 'currency', currency })
    .format(Number(decimalString));
}
