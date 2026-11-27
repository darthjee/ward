import { classifyError } from '../../bankErrors.js';

/** Fixed user-facing messages of the reconciliation error codes. */
export const RECONCILIATION_MESSAGES = new Map([
  ['RECONCILIATION_UNBALANCED', 'The difference must be 0 to finish.'],
  ['RECONCILIATION_OPEN', 'This account already has an open statement.'],
  ['RECONCILIATION_OUT_OF_ORDER', 'The statement date must be after the last finished statement.'],
  ['RECONCILIATION_NOT_LATEST', 'Only the latest finished statement can be undone.'],
  ['RECONCILIATION_FINISHED', 'This statement is already finished.'],
  ['TRANSACTION_NOT_ELIGIBLE', 'This transaction cannot be reconciled in this statement.'],
  ['TRANSACTION_CLEARED', 'This transaction is cleared and cannot be changed.'],
  ['ACCOUNT_RECONCILED', 'This account has reconciled transactions and cannot be changed this way.'],
]);

/**
 * Classify an error raised by a reconciliation request.
 *
 * @description Starts from `classifyError`; when the error code has a fixed message in
 * {@link RECONCILIATION_MESSAGES}, that message replaces the server's. Unmapped codes keep the
 * server message, and `sessionExpired`, `transient` and `forbidden` errors pass through.
 * @param {*} error - The caught error.
 * @returns {{kind: string, code: (string|undefined), message: string, messages: Array<string>}}
 *   The classification.
 */
export function classifyReconciliationError(error) {
  const classified = classifyError(error);

  if (classified.kind === 'transient' || classified.kind === 'sessionExpired'
    || classified.kind === 'forbidden' || !RECONCILIATION_MESSAGES.has(classified.code)) {
    return classified;
  }

  const message = RECONCILIATION_MESSAGES.get(classified.code);

  return { ...classified, message, messages: [message] };
}
