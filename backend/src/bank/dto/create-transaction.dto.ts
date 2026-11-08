import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DESCRIPTION_MAX_LENGTH, IsLedgerDate, NOTES_MAX_LENGTH } from './field-validators.js';
import { MaxCodePoints, trimString } from '../../core/string-validators.js';

/**
 * Request body for `POST <base>/accounts/:accountId/transactions.json`, taken
 * through `@StrictBody()`: `account_id`, owner fields, `sent_to_accountant_at`
 * and computed fields (`balance`) are not declared, so they answer 400.
 * `amount` is a signed decimal string, validated against the **account's**
 * currency by the service (non-zero, its exponent, at most 10^13 minor units).
 */
export class CreateTransactionDto {
  @IsLedgerDate()
    date!: string;

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
