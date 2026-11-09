import { BadRequestException } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { IsLedgerDate } from './field-validators.js';
import { ErrorCodes } from '../../core/error-codes.js';

/** Longest accepted hand-off range: `to − from`, in days. */
export const HAND_OFF_MAX_RANGE_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Query of `GET <base>/accountant/charges.json`: `from` / `to` (required
 * `YYYY-MM-DD` dates, each not after UTC today + 1 day) and `include_sent`
 * (`true` also lists sent charges; default `false`). A repeated parameter
 * answers 400; unknown parameters are stripped. The cross-field range rules
 * are checked by {@link assertHandOffRange}.
 */
export class AccountantChargesQueryDto {
  @IsLedgerDate()
    from!: string;

  @IsLedgerDate()
    to!: string;

  @IsOptional()
  @IsIn(['true', 'false'])
    include_sent?: 'true' | 'false';
}

/**
 * A hand-off 400 carrying the `VALIDATION_FAILED` code, like a DTO validation
 * failure (a bare `BadRequestException('…')` would map to `BAD_REQUEST`).
 * @param {string} message - The client-facing message.
 * @returns {BadRequestException} The exception to throw.
 */
export function handOffValidationFailed(message: string): BadRequestException {
  return new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message });
}

/**
 * Checks the hand-off range of two already-validated `YYYY-MM-DD` dates:
 * `from == to` (a single day) is allowed, `from` after `to` or `to − from`
 * over {@link HAND_OFF_MAX_RANGE_DAYS} days is not.
 * @param {string} from - The first day of the range.
 * @param {string} to - The last day of the range.
 * @returns {void}
 * @throws {BadRequestException} 400 `VALIDATION_FAILED` for an invalid range.
 */
export function assertHandOffRange(from: string, to: string): void {
  if (from > to) {
    throw handOffValidationFailed('from must not be after to');
  }

  if ((Date.parse(to) - Date.parse(from)) / DAY_MS > HAND_OFF_MAX_RANGE_DAYS) {
    throw handOffValidationFailed(`the range must not exceed ${HAND_OFF_MAX_RANGE_DAYS} days`);
  }
}
