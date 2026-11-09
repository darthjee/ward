import { buildMessage, ValidateBy, ValidateIf } from 'class-validator';
import { isSupportedCurrency } from '../currency.js';
import { isAllowedLedgerDate, isIsoDate } from '../ledger-date.js';

/** Longest accepted account name, in code points (`VARCHAR(255)`). */
export const ACCOUNT_NAME_MAX_LENGTH = 255;
/** Longest accepted `bank_name` / `branch` / `account_number` (`VARCHAR(64)`). */
export const ACCOUNT_SHORT_FIELD_MAX_LENGTH = 64;
/** Longest accepted transaction description (`VARCHAR(255)`). */
export const DESCRIPTION_MAX_LENGTH = 255;
/** Longest accepted `notes`, on accounts and transactions. */
export const NOTES_MAX_LENGTH = 2000;
/** Longest accepted `provider_tax_id` (`VARCHAR(32)`). */
export const PROVIDER_TAX_ID_MAX_LENGTH = 32;
/** Longest accepted `type` value (`VARCHAR(32)`). */
export const ACCOUNT_TYPE_MAX_LENGTH = 32;
/** Upper bound of an integer stored in a signed MySQL `int` column. */
export const MAX_INT_COLUMN = 2147483647;
/** The periods a rate (debt interest, investment yield) accepts. */
export const RATE_PERIODS = ['monthly', 'yearly'] as const;

/**
 * Validates the property only when it is present (not `undefined`), so an
 * explicit `null` is still checked (and rejected by `@IsString()` and the like)
 * instead of being skipped as `@IsOptional()` would.
 * @returns {PropertyDecorator} The conditional-validation decorator.
 */
export function IsOptionalNonNull(): PropertyDecorator {
  return ValidateIf((_object: unknown, value: unknown) => value !== undefined);
}

/**
 * Validates an ISO 4217 code supported by `Intl.supportedValuesOf('currency')`.
 * @returns {PropertyDecorator} The validation decorator.
 */
export function IsSupportedCurrency(): PropertyDecorator {
  return ValidateBy({
    name: 'isSupportedCurrency',
    validator: {
      validate: (value: unknown): boolean => typeof value === 'string' && isSupportedCurrency(value),
      defaultMessage: buildMessage((eachPrefix) => `${eachPrefix}$property must be a supported ISO 4217 currency code`),
    },
  });
}

/**
 * Validates a `YYYY-MM-DD` ledger date not after UTC today + 1 day.
 * @returns {PropertyDecorator} The validation decorator.
 */
export function IsLedgerDate(): PropertyDecorator {
  return ValidateBy({
    name: 'isLedgerDate',
    validator: {
      validate: (value: unknown): boolean => isAllowedLedgerDate(value, new Date()),
      defaultMessage: buildMessage(
        (eachPrefix) => `${eachPrefix}$property must be a YYYY-MM-DD date no later than tomorrow (UTC)`,
      ),
    },
  });
}

/**
 * Validates a `YYYY-MM-DD` string naming a real calendar day, past or future
 * (no "today + 1" bound, unlike {@link IsLedgerDate}).
 * @returns {PropertyDecorator} The validation decorator.
 */
export function IsCalendarDate(): PropertyDecorator {
  return ValidateBy({
    name: 'isCalendarDate',
    validator: {
      validate: (value: unknown): boolean => isIsoDate(value),
      defaultMessage: buildMessage((eachPrefix) => `${eachPrefix}$property must be a valid YYYY-MM-DD date`),
    },
  });
}

/**
 * Trims a string and turns a blank one into `null` (an optional free-text
 * field cleared by the user), leaving any other value untouched so
 * `@IsString()` still rejects it.
 * @param {{ value: unknown }} params - class-transformer's transform parameters.
 * @returns {unknown} The trimmed string, `null`, or the original value.
 */
export function trimToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
}

/** Highest accepted rate (debt interest, investment yield), in percent. */
export const INTEREST_RATE_MAX = 100;

// A non-negative decimal with at most 4 fractional digits (`DECIMAL(7,4)`).
const INTEREST_RATE_FORMAT = /^\d+(\.\d{1,4})?$/;

/**
 * @param {unknown} value - The raw value.
 * @returns {boolean} Whether `value` is a decimal string between 0 and
 *   {@link INTEREST_RATE_MAX} with at most 4 decimals.
 */
export function isInterestRate(value: unknown): boolean {
  return typeof value === 'string' && INTEREST_RATE_FORMAT.test(value) && Number(value) <= INTEREST_RATE_MAX;
}

/**
 * Validates a rate (debt interest, investment yield): a decimal string, 0–100, at most 4 decimals.
 * @returns {PropertyDecorator} The validation decorator.
 */
export function IsInterestRate(): PropertyDecorator {
  return ValidateBy({
    name: 'isInterestRate',
    validator: {
      validate: isInterestRate,
      defaultMessage: buildMessage(
        (eachPrefix) => `${eachPrefix}$property must be a decimal string between 0 and 100 with at most 4 decimals`,
      ),
    },
  });
}
