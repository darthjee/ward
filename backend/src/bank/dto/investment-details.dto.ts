import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsCalendarDate, IsInterestRate, MAX_INT_COLUMN, RATE_PERIODS } from './field-validators.js';
import type { InvestmentKind, InvestmentYieldPeriod } from '../entities/investment-details.entity.js';

/** The kinds of product an investment account accepts. */
export const INVESTMENT_KINDS: readonly InvestmentKind[] = [
  'fixed_income',
  'fund',
  'stocks',
  'savings',
  'pension',
  'crypto',
  'other',
];

/**
 * The nested `investment` object of an account body (see
 * `docs/agents/specs/banking/accounts/investment.md`). Every field is
 * optional and accepts `null` (clears it). Only formats and ranges are
 * checked here: the paired `yield_rate` ↔ `yield_period` rule runs in the
 * investment handler, on the merged state for a PATCH. Unknown keys answer
 * 400 through the strict pipe's whitelist.
 */
export class InvestmentDetailsDto {
  @IsOptional()
  @IsIn(INVESTMENT_KINDS)
    kind?: InvestmentKind | null;

  @IsOptional()
  @IsInterestRate()
    yield_rate?: string | null;

  @IsOptional()
  @IsIn(RATE_PERIODS)
    yield_period?: InvestmentYieldPeriod | null;

  @IsOptional()
  @IsCalendarDate()
    maturity_date?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_INT_COLUMN)
    liquidity_days?: number | null;
}
