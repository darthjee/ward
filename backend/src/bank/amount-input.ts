import { BadRequestException } from '@nestjs/common';
import { convertExponent, InvalidAmountError, parseAmount, type ParseAmountOptions } from './currency.js';

/**
 * Runs a currency conversion, turning an {@link InvalidAmountError} into a 400
 * naming the offending body field.
 * @param {string} field - The body field (e.g. `amount`).
 * @param {() => bigint} convert - The conversion.
 * @returns {bigint} The converted amount, in minor units.
 * @throws {BadRequestException} When the amount is invalid.
 */
function asBadRequest(field: string, convert: () => bigint): bigint {
  try {
    return convert();
  } catch (error) {
    if (error instanceof InvalidAmountError) {
      throw new BadRequestException(`${field} ${error.message}`);
    }

    throw error;
  }
}

/**
 * Parses a decimal-string body amount into minor units of `currency`.
 * @param {string} field - The body field, for the error message.
 * @param {string} value - The decimal string.
 * @param {string} currency - The account's ISO 4217 code.
 * @param {ParseAmountOptions} options - Extra rules (e.g. `nonZero`).
 * @returns {bigint} The amount in minor units.
 * @throws {BadRequestException} When the amount is malformed, has too many
 *   decimals, is zero while `nonZero` is set, or is over 10^13 minor units.
 */
export function parseAmountInput(
  field: string,
  value: string,
  currency: string,
  options: ParseAmountOptions = {},
): bigint {
  return asBadRequest(field, () => parseAmount(value, currency, options));
}

/**
 * Re-expresses a stored amount in a new currency's exponent (no FX).
 * @param {string} field - The field, for the error message.
 * @param {bigint} minor - The amount in minor units of `from`.
 * @param {string} from - The current ISO 4217 code.
 * @param {string} to - The new ISO 4217 code.
 * @returns {bigint} The amount in minor units of `to`.
 * @throws {BadRequestException} When the value cannot be represented in `to`.
 */
export function convertAmountInput(field: string, minor: bigint, from: string, to: string): bigint {
  return asBadRequest(field, () => convertExponent(minor, from, to));
}
