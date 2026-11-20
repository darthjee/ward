import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { PROVIDER_BILL_KINDS, PROVIDER_CHARGE_FREQUENCIES } from './create-provider-bill.dto.js';
import { DESCRIPTION_MAX_LENGTH, IsCalendarDate, IsOptionalNonNull, MAX_INT_COLUMN, NOTES_MAX_LENGTH } from './field-validators.js';
import { MaxCodePoints, trimString } from '../../core/string-validators.js';
import type { ProviderChargeFrequency } from '../entities/provider-bill.entity.js';

/**
 * Request body for `PATCH <base>/provider-bills/:id.json`: the fields of
 * `CreateProviderBillDto`, all optional, plus `provider_account_id` (a
 * one-off moves to another provider). `kind` is only compared with the stored
 * one (a different value answers 409), never applied.
 */
export class UpdateProviderBillDto {
  @IsOptionalNonNull()
  @IsIn(PROVIDER_BILL_KINDS)
    kind?: 'recurring' | 'one_off';

  @IsOptionalNonNull()
  @IsInt()
  @Min(1)
  @Max(MAX_INT_COLUMN)
    provider_account_id?: number;

  @IsOptionalNonNull()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(DESCRIPTION_MAX_LENGTH)
    description?: string;

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
