import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { DESCRIPTION_MAX_LENGTH, IsCalendarDate, MAX_INT_COLUMN, NOTES_MAX_LENGTH } from './field-validators.js';
import { MaxCodePoints, trimString } from '../../core/string-validators.js';

/**
 * Request body for `POST <base>/bills.json` (see
 * `docs/agents/modules/bank/bills.md`, *One-off bills*), taken through
 * `@StrictBody()`: owner fields and unknown fields answer 400. `amount` is a
 * decimal string, validated against the **provider's** currency by the
 * service (> 0, its exponent, at most 10^13 minor units). Values out of bounds
 * answer 400, never truncated.
 */
export class CreateBillDto {
  @IsInt()
  @Min(1)
  @Max(MAX_INT_COLUMN)
    provider_account_id!: number;

  @IsInt()
  @Min(1)
  @Max(MAX_INT_COLUMN)
    paying_account_id!: number;

  @IsCalendarDate()
    due_date!: string;

  @IsString()
    amount!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(DESCRIPTION_MAX_LENGTH)
    description!: string;

  @IsOptional()
  @IsString()
  @MaxCodePoints(NOTES_MAX_LENGTH)
    notes?: string | null;
}
