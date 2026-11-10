import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsCalendarDate, IsInterestRate, IsOptionalNonNull, MAX_INT_COLUMN, RATE_PERIODS } from './field-validators.js';

/** The periods a debt's interest rate and instalment frequency accept. */
export const DEBT_PERIODS = RATE_PERIODS;

/**
 * The nested `debt` object of an account body (see
 * `docs/agents/specs/banking/accounts/debt.md`). Every field is optional, and
 * all but `instalment_frequency` accept `null` (clears it). Only formats and
 * ranges are checked here: the paired rules (rate ↔ period, yearly ↔
 * `due_month`) and the `instalment_amount` parsing against the account
 * currency run in the debt handler, on the merged state for a PATCH. Unknown
 * keys answer 400 through the strict pipe's whitelist.
 */
export class DebtDetailsDto {
  @IsOptional()
  @IsInterestRate()
    interest_rate?: string | null;

  @IsOptional()
  @IsIn(DEBT_PERIODS)
    interest_period?: 'monthly' | 'yearly' | null;

  @IsOptional()
  @IsString()
    instalment_amount?: string | null;

  @IsOptionalNonNull()
  @IsIn(DEBT_PERIODS)
    instalment_frequency?: 'monthly' | 'yearly';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
    due_day?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
    due_month?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT_COLUMN)
    instalment_count?: number | null;

  @IsOptional()
  @IsCalendarDate()
    bills_from?: string | null;

  @IsOptionalNonNull()
  @IsBoolean()
    show_in_calendar?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT_COLUMN)
    paying_account_id?: number | null;
}
