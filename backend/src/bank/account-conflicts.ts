import { ConflictException } from '@nestjs/common';
import { isMysqlError, MYSQL_DUPLICATE_ENTRY } from './mysql-errors.js';
import { ErrorCodes } from '../core/error-codes.js';

/**
 * @returns {ConflictException} 409: an active account of the same owner already has this name.
 */
export function accountNameTaken(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ACCOUNT_NAME_TAKEN,
    message: 'An active account with this name already exists',
  });
}

/**
 * @returns {ConflictException} 409: the account has transactions, so it cannot be deleted.
 */
export function accountHasTransactions(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ACCOUNT_HAS_TRANSACTIONS,
    message: 'The account has transactions and cannot be deleted; archive it instead',
  });
}

/**
 * @returns {ConflictException} 409: the account is archived (read-only apart from rename / unarchive).
 */
export function accountArchived(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ACCOUNT_ARCHIVED,
    message: 'The account is archived; only renaming and unarchiving are allowed',
  });
}

/**
 * @returns {ConflictException} 409: the currency cannot change once the account has transactions.
 */
export function currencyLocked(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.CURRENCY_LOCKED,
    message: 'The currency cannot change once the account has transactions',
  });
}

/**
 * Runs an account write, mapping a unique-index violation (the per-owner
 * active-name indexes, `ER_DUP_ENTRY`) to {@link accountNameTaken}.
 * @param {() => Promise<T>} write - The write.
 * @returns {Promise<T>} The write's result.
 * @throws {ConflictException} 409 on a name clash.
 */
export async function mapNameClash<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isMysqlError(error, MYSQL_DUPLICATE_ENTRY)) {
      throw accountNameTaken();
    }

    throw error;
  }
}
