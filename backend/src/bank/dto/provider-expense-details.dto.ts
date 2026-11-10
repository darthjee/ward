import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsCalendarDate, IsOptionalNonNull, MAX_INT_COLUMN, PROVIDER_TAX_ID_MAX_LENGTH, RATE_PERIODS, trimToNull } from './field-validators.js';
import { MaxCodePoints } from '../../core/string-validators.js';
import type { ProviderChargeFrequency } from '../entities/provider-expense-details.entity.js';

/** The frequencies a provider charge accepts. */
export const PROVIDER_CHARGE_FREQUENCIES = RATE_PERIODS;

/**
 * The nested `provider_expense` object of an account body (see
 * `docs/agents/specs/banking/accounts/provider-expense.md`). Every field is
 * optional; all but `for_accountant` and `charge_frequency` accept `null`
 * (clears it). Only formats and ranges are checked here: the paired
 * `charge_frequency` ↔ `due_month` rule and the `expected_amount` parsing
 * against the account currency run in the provider-expense handler, on the
 * merged state for a PATCH. Unknown keys answer 400 through the strict pipe's
 * whitelist.
 */
export class ProviderExpenseDetailsDto {
  @IsOptionalNonNull()
  @IsBoolean()
    for_accountant?: boolean;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxCodePoints(PROVIDER_TAX_ID_MAX_LENGTH)
    provider_tax_id?: string | null;

  @IsOptional()
  @IsString()
    expected_amount?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
    due_day?: number | null;

  @IsOptionalNonNull()
  @IsIn(PROVIDER_CHARGE_FREQUENCIES)
    charge_frequency?: ProviderChargeFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
    due_month?: number | null;

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
