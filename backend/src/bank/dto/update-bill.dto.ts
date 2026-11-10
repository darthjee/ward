import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { DESCRIPTION_MAX_LENGTH, IsCalendarDate, IsOptionalNonNull, MAX_INT_COLUMN, NOTES_MAX_LENGTH } from './field-validators.js';
import { MaxCodePoints, trimString } from '../../core/string-validators.js';

/**
 * Request body for `PATCH <base>/bills/:id.json`: the fields of
 * `CreateBillDto`, all optional. `paying_account_id: null` clears the default
 * paying account (the Pay dialog then requires a choice); `notes: null`
 * clears the notes.
 */
export class UpdateBillDto {
  @IsOptionalNonNull()
  @IsInt()
  @Min(1)
  @Max(MAX_INT_COLUMN)
    provider_account_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT_COLUMN)
    paying_account_id?: number | null;

  @IsOptionalNonNull()
  @IsCalendarDate()
    due_date?: string;

  @IsOptionalNonNull()
  @IsString()
    amount?: string;

  @IsOptionalNonNull()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(DESCRIPTION_MAX_LENGTH)
    description?: string;

  @IsOptional()
  @IsString()
  @MaxCodePoints(NOTES_MAX_LENGTH)
    notes?: string | null;
}
