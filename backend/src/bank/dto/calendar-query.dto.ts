import { BadRequestException } from '@nestjs/common';
import { IsCalendarDate } from './field-validators.js';
import { ErrorCodes } from '../../core/error-codes.js';

/** Longest accepted calendar range: `to − from`, in days. */
export const CALENDAR_MAX_RANGE_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Query of `GET <base>/calendar.json`: `from` / `to`, required `YYYY-MM-DD`
 * dates (past or future). A repeated parameter answers 400; unknown
 * parameters are stripped. The cross-field range rules are checked by
 * {@link assertCalendarRange}.
 */
export class CalendarQueryDto {
  @IsCalendarDate()
    from!: string;

  @IsCalendarDate()
    to!: string;
}

/**
 * Checks the calendar range of two already-validated dates: `from == to` (a
 * single day) is allowed, `from` after `to` or `to − from` over
 * {@link CALENDAR_MAX_RANGE_DAYS} days is not.
 * @param {string} from - The first day of the range.
 * @param {string} to - The last day of the range.
 * @returns {void}
 * @throws {BadRequestException} 400 `VALIDATION_FAILED` for an invalid range.
 */
export function assertCalendarRange(from: string, to: string): void {
  if (from > to) {
    throw new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message: 'from must not be after to' });
  }

  if ((Date.parse(to) - Date.parse(from)) / DAY_MS > CALENDAR_MAX_RANGE_DAYS) {
    throw new BadRequestException({
      code: ErrorCodes.VALIDATION_FAILED,
      message: `the range must not exceed ${CALENDAR_MAX_RANGE_DAYS} days`,
    });
  }
}
