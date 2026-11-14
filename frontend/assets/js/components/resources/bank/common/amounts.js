import DisplayLocale from '../../../../utils/locale/DisplayLocale.js';

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
 * @description Uses the user's display locale (browser default when unset). Amounts are
 * bounded by the 10¹³ minor-unit cap, well within `Number`'s safe range.
 * @param {string} decimalString - The API's decimal string.
 * @param {string} currency - ISO 4217 code.
 * @returns {string} The formatted amount (empty when no amount).
 */
export function formatMoney(decimalString, currency) {
  if (decimalString === null || decimalString === undefined || decimalString === '') {
    return '';
  }

  return new Intl.NumberFormat(DisplayLocale.get(), { style: 'currency', currency })
    .format(Number(decimalString));
}

/**
 * Read a decimal string as signed minor units of a currency (no float arithmetic).
 *
 * @param {string} amount - The decimal string (e.g. `'-12.5'`, `'1000.00'`).
 * @param {number} digits - The currency's decimal places.
 * @returns {bigint} The signed amount in minor units (fraction digits beyond `digits` are
 *   truncated; `0n` for a blank or malformed value).
 */
function toMinorUnits(amount, digits) {
  const match = AMOUNT_PATTERN.exec(String(amount ?? '').trim());

  if (!match) {
    return 0n;
  }

  const [, sign, integer, fraction = ''] = match;
  const minor = minorUnits(integer, fraction.slice(0, digits), digits);

  return sign ? -minor : minor;
}

/**
 * Format signed minor units as a decimal string with the currency's decimal places.
 *
 * @param {bigint} minor - The signed amount in minor units.
 * @param {number} digits - The currency's decimal places.
 * @returns {string} The decimal string (e.g. `-12.50`), never `-0`.
 */
function fromMinorUnits(minor, digits) {
  const sign = minor < 0n ? '-' : '';
  const absolute = String(minor < 0n ? -minor : minor).padStart(digits + 1, '0');

  if (digits === 0) {
    return `${sign}${absolute}`;
  }

  return `${sign}${absolute.slice(0, -digits)}.${absolute.slice(-digits)}`;
}

/**
 * Subtract two decimal strings in a currency, exactly: `a − b`.
 *
 * @description Both amounts are read as BigInt minor units with the currency's decimals
 * (`currencyDigits`), so no float rounding happens. Used by Investments' Update value
 * (current value − balance).
 * @param {string} a - The minuend decimal string.
 * @param {string} b - The subtrahend decimal string.
 * @param {string} currency - ISO 4217 code.
 * @returns {string} The difference as a decimal string with the currency's decimals (e.g.
 *   `'-12.50'`, `'0.00'`).
 */
export function subtractAmounts(a, b, currency) {
  const digits = currencyDigits(currency);

  return fromMinorUnits(toMinorUnits(a, digits) - toMinorUnits(b, digits), digits);
}

/**
 * Whether a decimal string is zero (`'0'`, `'0.00'`, `'-0.0'`).
 *
 * @param {string} amount - The decimal string.
 * @returns {boolean} `true` for a zero amount.
 */
export function isZeroAmount(amount) {
  return /^-?0+(?:[.,]0*)?$/.test(String(amount ?? '').trim());
}

/**
 * Sum decimal strings in a currency, exactly.
 *
 * @description Every amount is read as BigInt minor units with the currency's decimals
 * (`currencyDigits`), so no float rounding happens. Used by the accountant hand-off's
 * per-currency totals.
 * @param {Array<string>} decimals - The decimal strings.
 * @param {string} currency - ISO 4217 code.
 * @returns {string} The sum as a decimal string with the currency's decimals (`'0.00'` for an
 *   empty list in BRL, `'0'` in JPY).
 */
export function sumAmounts(decimals, currency) {
  const digits = currencyDigits(currency);
  const total = decimals.reduce((sum, amount) => sum + toMinorUnits(amount, digits), 0n);

  return fromMinorUnits(total, digits);
}
