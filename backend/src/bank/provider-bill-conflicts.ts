import { ConflictException } from '@nestjs/common';
import { isMysqlError, MYSQL_DUPLICATE_ENTRY } from './mysql-errors.js';
import { ErrorCodes } from '../core/error-codes.js';

/** The most recurring bills one provider account can hold. */
export const PROVIDER_BILL_RECURRING_LIMIT = 50;

/**
 * @returns {ConflictException} 409: the bill `kind` cannot change.
 */
export function providerBillKindLocked(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROVIDER_BILL_KIND_LOCKED,
    message: 'The kind of a provider bill cannot change',
  });
}

/**
 * @returns {ConflictException} 409: a recurring bill cannot move to another provider.
 */
export function providerBillProviderLocked(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROVIDER_BILL_PROVIDER_LOCKED,
    message: 'A recurring bill cannot move to another provider',
  });
}

/**
 * @returns {ConflictException} 409: the provider already has a recurring bill with that description.
 */
export function providerBillNameTaken(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROVIDER_BILL_NAME_TAKEN,
    message: 'The provider already has a recurring bill with that description',
  });
}

/**
 * @returns {ConflictException} 409: the bill is paid, so it cannot be deleted or moved.
 */
export function providerBillPaid(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROVIDER_BILL_PAID,
    message: 'The bill is paid; undo the payment first',
  });
}

/**
 * @returns {ConflictException} 409: the provider already holds the maximum of recurring bills.
 */
export function providerBillLimit(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.PROVIDER_BILL_LIMIT,
    message: `A provider holds at most ${PROVIDER_BILL_RECURRING_LIMIT} recurring bills`,
  });
}

/**
 * Runs a write, mapping a recurring-description unique violation to 409.
 * @param {() => Promise<T>} write - The write.
 * @returns {Promise<T>} The write's result.
 * @throws {ConflictException} `PROVIDER_BILL_NAME_TAKEN` on `ER_DUP_ENTRY`.
 */
export async function mapProviderBillNameClash<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isMysqlError(error, MYSQL_DUPLICATE_ENTRY)) {
      throw providerBillNameTaken();
    }

    throw error;
  }
}

/**
 * Compares two descriptions the way the database unique key does (trimmed,
 * case- and accent-insensitive).
 * @param {string} a - A description.
 * @param {string} b - Another description.
 * @returns {boolean} Whether they collide.
 */
export function sameDescription(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'base' }) === 0;
}
