import { ConflictException } from '@nestjs/common';
import { ErrorCodes } from '../core/error-codes.js';

/**
 * @returns {ConflictException} 409: the occurrence already has a payment or skip (undo it first).
 */
export function occurrenceAlreadyPaid(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.OCCURRENCE_ALREADY_PAID,
    message: 'The occurrence is already paid or skipped; undo it first',
  });
}

/**
 * @returns {ConflictException} 409: the one-off bill is paid, so it cannot be deleted or moved.
 */
export function billPaid(): ConflictException {
  return new ConflictException({
    code: ErrorCodes.BILL_PAID,
    message: 'The bill is paid; undo the payment first',
  });
}
