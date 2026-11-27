import { ConflictException } from '@nestjs/common';
import { isMysqlError, MYSQL_DUPLICATE_ENTRY, MYSQL_LOCK_DEADLOCK, MYSQL_LOCK_WAIT_TIMEOUT } from './mysql-errors.js';
import { ErrorCodes } from '../core/error-codes.js';

/*
 * The messages are fixed static text: they never carry a balance, difference, date, id or count
 * (see `docs/agents/modules/bank/reconciliation.md`, *Data sensitivity and ownership*).
 */

/**
 * @returns {ConflictException} 409: the account already has an open reconciliation.
 */
export function reconciliationOpen(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.RECONCILIATION_OPEN,
    message: 'This account already has an open reconciliation.',
  });
}

/**
 * @returns {ConflictException} 409: the reconciliation is already finished.
 */
export function reconciliationFinished(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.RECONCILIATION_FINISHED,
    message: 'This reconciliation is already finished.',
  });
}

/**
 * @returns {ConflictException} 409: the reconciliation is not finished.
 */
export function reconciliationNotFinished(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.RECONCILIATION_NOT_FINISHED,
    message: 'This reconciliation is not finished.',
  });
}

/**
 * @returns {ConflictException} 409: only the latest finished reconciliation can be undone.
 */
export function reconciliationNotLatest(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.RECONCILIATION_NOT_LATEST,
    message: 'Only the latest finished reconciliation can be undone.',
  });
}

/**
 * @returns {ConflictException} 409: the statement date is not after the latest finished reconciliation.
 */
export function reconciliationOutOfOrder(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.RECONCILIATION_OUT_OF_ORDER,
    message: 'The statement date must be after the latest finished reconciliation.',
  });
}

/**
 * @returns {ConflictException} 409: the reconciliation is not balanced, so it cannot be finished.
 */
export function reconciliationUnbalanced(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.RECONCILIATION_UNBALANCED,
    message: 'The reconciliation is not balanced.',
  });
}

/**
 * @returns {ConflictException} 409: a selected transaction cannot be part of this reconciliation.
 */
export function transactionNotEligible(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.TRANSACTION_NOT_ELIGIBLE,
    message: 'A selected transaction cannot be part of this reconciliation.',
  });
}

/**
 * @returns {ConflictException} 409: the transaction is part of a finished reconciliation.
 */
export function transactionCleared(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.TRANSACTION_CLEARED,
    message: 'This transaction is part of a finished reconciliation.',
  });
}

/**
 * @returns {ConflictException} 409: the opening date and balance are frozen once the account has a reconciliation.
 */
export function accountReconciled(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.ACCOUNT_RECONCILED,
    message: 'The opening date and balance cannot change once the account has a reconciliation.',
  });
}

/**
 * @returns {ConflictException} 409: the request collided with another change (deadlock or lock wait timeout); retry.
 */
export function concurrentUpdate(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.CONCURRENT_UPDATE,
    message: 'The request conflicted with another change; please retry.',
  });
}

/**
 * Runs a write, mapping a deadlock (`ER_LOCK_DEADLOCK`) or a lock wait timeout
 * (`ER_LOCK_WAIT_TIMEOUT`) to {@link concurrentUpdate}.
 * Any other error passes through unchanged.
 * @param {() => Promise<T>} write - The write.
 * @returns {Promise<T>} The write's result.
 * @throws {ConflictException} 409 when the database picked the request as a deadlock victim or its lock wait timed out.
 */
export async function mapDeadlock<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isMysqlError(error, MYSQL_LOCK_DEADLOCK) || isMysqlError(error, MYSQL_LOCK_WAIT_TIMEOUT)) {
      throw concurrentUpdate();
    }

    throw error;
  }
}

/**
 * Runs a reconciliation write, mapping a unique-index violation (the generated `open_key` index,
 * `ER_DUP_ENTRY`) to {@link reconciliationOpen}.
 * @param {() => Promise<T>} write - The write.
 * @returns {Promise<T>} The write's result.
 * @throws {ConflictException} 409 when the account already has an open reconciliation.
 */
export async function mapOpenClash<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isMysqlError(error, MYSQL_DUPLICATE_ENTRY)) {
      throw reconciliationOpen();
    }

    throw error;
  }
}
