import { QueryFailedError } from 'typeorm';

/** MySQL error code of a unique-index violation (errno 1062). */
export const MYSQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';
/** MySQL error code of a delete refused by a referencing FK (errno 1451). */
export const MYSQL_ROW_IS_REFERENCED = 'ER_ROW_IS_REFERENCED_2';
/** MySQL error code of a deadlock picked as the victim (errno 1213). */
export const MYSQL_LOCK_DEADLOCK = 'ER_LOCK_DEADLOCK';
/** MySQL error code of a lock wait that timed out (errno 1205). */
export const MYSQL_LOCK_WAIT_TIMEOUT = 'ER_LOCK_WAIT_TIMEOUT';

/**
 * @param {unknown} error - A thrown value.
 * @param {string} code - The MySQL error code (e.g. {@link MYSQL_DUPLICATE_ENTRY}).
 * @returns {boolean} `true` when `error` is a TypeORM query failure whose
 *   driver error carries `code`.
 */
export function isMysqlError(error: unknown, code: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;

  return typeof driverError === 'object' && driverError !== null && 'code' in driverError && driverError.code === code;
}
