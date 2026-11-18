import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { DESCRIPTION_MAX_LENGTH, IsCalendarDate, IsOptionalNonNull, MAX_INT_COLUMN, NOTES_MAX_LENGTH } from './field-validators.js';
import { PROVIDER_CHARGE_FREQUENCIES } from './provider-expense-details.dto.js';
import { MaxCodePoints, trimString } from '../../core/string-validators.js';
import type { ProviderChargeFrequency } from '../entities/provider-expense-details.entity.js';

/** The accepted provider bill kinds. */
export const PROVIDER_BILL_KINDS = ['recurring', 'one_off'] as const;

/**
 * Request body for `POST <base>/accounts/:accountId/provider-bills.json`,
 * taken through `@StrictBody()`. Formats and ranges only; the per-kind
 * required / forbidden matrix runs on the merged state in
 * `provider-bill-fields.ts`.
 */
export class CreateProviderBillDto {
  @IsIn(PROVIDER_BILL_KINDS)
    kind!: 'recurring' | 'one_off';

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(DESCRIPTION_MAX_LENGTH)
    description!: string;

  @IsOptional()
  @IsString()
    expected_amount?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT_COLUMN)
    paying_account_id?: number | null;

  @IsOptional()
  @IsString()
  @MaxCodePoints(NOTES_MAX_LENGTH)
    notes?: string | null;

  @IsOptionalNonNull()
  @IsIn(PROVIDER_CHARGE_FREQUENCIES)
    charge_frequency?: ProviderChargeFrequency;

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

  @IsOptionalNonNull()
  @IsCalendarDate()
    bills_from?: string;

  @IsOptionalNonNull()
  @IsBoolean()
    show_in_calendar?: boolean;

  @IsOptional()
  @IsCalendarDate()
    due_date?: string | null;
}
