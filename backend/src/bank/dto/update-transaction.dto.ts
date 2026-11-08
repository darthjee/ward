import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DESCRIPTION_MAX_LENGTH, IsLedgerDate, IsOptionalNonNull, NOTES_MAX_LENGTH } from './field-validators.js';
import { MaxCodePoints, trimString } from '../../core/string-validators.js';

/**
 * Request body for `PATCH <base>/accounts/:accountId/transactions/:transactionId.json`:
 * the fields of `CreateTransactionDto`, all optional (`notes: null` clears the
 * notes). Taken through `@StrictBody()`, so a transaction can never move to
 * another account and owner or computed fields answer 400.
 */
export class UpdateTransactionDto {
  @IsOptionalNonNull()
  @IsLedgerDate()
    date?: string;

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
