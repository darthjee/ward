import { UnprocessableEntityException } from '@nestjs/common';
import { ErrorCodes } from '../core/error-codes.js';

/**
 * The generic 422 of an account id sent in a request body
 * (`provider_account_id`, `paying_account_id`) that is unknown, of another
 * owner or context, of the wrong type, or an archived paying account. The body
 * is identical for every reason, so nothing can be probed.
 * @returns {UnprocessableEntityException} 422 "account not found".
 */
export function accountNotFoundInBody(): UnprocessableEntityException {
  return new UnprocessableEntityException({ code: ErrorCodes.ACCOUNT_NOT_FOUND, message: 'account not found' });
}

/**
 * The 422 of a visible, same-owner account whose currency differs from the
 * one required (a payment writes the same amount to both accounts).
 * @returns {UnprocessableEntityException} 422 "currency mismatch".
 */
export function currencyMismatch(): UnprocessableEntityException {
  return new UnprocessableEntityException({ code: ErrorCodes.CURRENCY_MISMATCH, message: 'currency mismatch' });
}
