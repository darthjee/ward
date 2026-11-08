// Pure currency helpers: ISO 4217 support checks, the currency exponent and
// exact conversions between decimal strings and integer minor units. Never
// goes through `Number` or any float.

// Largest accepted `|amount|`, in minor units (10^13).
export const MAX_ABS_MINOR_UNITS = 10n ** 13n;

// Longest decimal string considered at all; anything longer is rejected
// before any BigInt work (well above the 10^13 cap plus any exponent).
const MAX_AMOUNT_LENGTH = 32;

const AMOUNT_PATTERN = /^([+-])?(\d+)(?:\.(\d+))?$/;

let supportedCurrencies: ReadonlySet<string> | null = null;

/**
 * Raised by {@link parseAmount} on any invalid amount. Services map it to a
 * 400 response.
 */
export class InvalidAmountError extends Error {
  /**
   * @param {string} message - Why the amount was rejected.
   */
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAmountError';
  }
}

/**
 * Options for {@link parseAmount}.
 */
export interface ParseAmountOptions {
  /** Reject a zero amount (e.g. a transaction amount). */
  nonZero?: boolean;
}

/**
 * @param {string} code - A candidate ISO 4217 code.
 * @returns {boolean} `true` when `code` is in `Intl.supportedValuesOf('currency')`.
 */
export function isSupportedCurrency(code: string): boolean {
  if (!supportedCurrencies) {
    supportedCurrencies = new Set(Intl.supportedValuesOf('currency'));
  }

  return supportedCurrencies.has(code);
}

/**
 * @param {string} code - A supported ISO 4217 code.
 * @returns {number} The number of minor-unit digits of the currency
 *   (BRL/USD 2, JPY 0, BHD 3), as reported by `Intl.NumberFormat`.
 */
export function currencyExponent(code: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency: code })
    .resolvedOptions().maximumFractionDigits as number;
}

/**
 * Converts a decimal string (e.g. `"-1234.56"`) into integer minor units of
 * `currency`.
 * @param {string} value - An optionally signed decimal string.
 * @param {string} currency - The ISO 4217 code whose exponent applies.
 * @param {ParseAmountOptions} options - Extra rules (e.g. `nonZero`).
 * @returns {bigint} The amount in minor units.
 * @throws {InvalidAmountError} When the string is malformed, has more
 *   decimals than the currency allows, is zero while `nonZero` is set, or
 *   exceeds {@link MAX_ABS_MINOR_UNITS} in absolute value.
 */
export function parseAmount(value: string, currency: string, options: ParseAmountOptions = {}): bigint {
  const match = typeof value === 'string' && value.length <= MAX_AMOUNT_LENGTH
    ? AMOUNT_PATTERN.exec(value)
    : null;

  if (!match) {
    throw new InvalidAmountError('amount must be a decimal string');
  }

  const [, sign, integerPart, fraction = ''] = match;
  const exponent = currencyExponent(currency);

  if (fraction.length > exponent) {
    throw new InvalidAmountError(`amount allows at most ${exponent} decimal places for ${currency}`);
  }

  const magnitude = BigInt(integerPart + fraction.padEnd(exponent, '0'));

  return checkedAmount(sign === '-' ? -magnitude : magnitude, options);
}

/**
 * Converts integer minor units back into a decimal string in the currency's
 * exponent: `-123456n` in BRL gives `"-1234.56"`, `500n` in JPY gives `"500"`.
 * @param {bigint} minor - The amount in minor units.
 * @param {string} currency - The ISO 4217 code whose exponent applies.
 * @returns {string} The decimal string.
 */
export function formatAmount(minor: bigint, currency: string): string {
  const exponent = currencyExponent(currency);
  const negative = minor < 0n;
  const digits = (negative ? -minor : minor).toString().padStart(exponent + 1, '0');
  const sign = negative ? '-' : '';

  if (exponent === 0) {
    return `${sign}${digits}`;
  }

  const cut = digits.length - exponent;

  return `${sign}${digits.slice(0, cut)}.${digits.slice(cut)}`;
}

/**
 * Applies the zero and overflow rules to a parsed amount.
 * @param {bigint} amount - The parsed amount in minor units.
 * @param {ParseAmountOptions} options - Extra rules (e.g. `nonZero`).
 * @returns {bigint} `amount`, unchanged.
 * @throws {InvalidAmountError} When a rule is broken.
 */
function checkedAmount(amount: bigint, options: ParseAmountOptions): bigint {
  if (options.nonZero && amount === 0n) {
    throw new InvalidAmountError('amount must not be zero');
  }

  if (amount > MAX_ABS_MINOR_UNITS || amount < -MAX_ABS_MINOR_UNITS) {
    throw new InvalidAmountError('amount is too large');
  }

  return amount;
}
