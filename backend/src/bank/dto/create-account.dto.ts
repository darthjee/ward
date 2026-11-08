import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_SHORT_FIELD_MAX_LENGTH,
  ACCOUNT_TYPE_MAX_LENGTH,
  IsLedgerDate,
  IsOptionalNonNull,
  IsSupportedCurrency,
  NOTES_MAX_LENGTH,
  trimToNull,
} from './field-validators.js';
import { MaxCodePoints, trimString } from '../../core/string-validators.js';

/**
 * Request body for `POST <base>/accounts.json`, taken through
 * `@StrictBody()`: owner fields (`user_id`, `organization_id`, …), ids and
 * computed fields (`balance`) are not declared, so they answer 400. `type`
 * defaults to `regular`; any type without a registered handler answers 400
 * (checked by the service). `opening_balance` is a decimal string whose
 * decimals are checked against the currency by the service.
 */
export class CreateAccountDto {
  @IsOptionalNonNull()
  @IsString()
  @MaxCodePoints(ACCOUNT_TYPE_MAX_LENGTH)
    type?: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(ACCOUNT_NAME_MAX_LENGTH)
    name!: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxCodePoints(ACCOUNT_SHORT_FIELD_MAX_LENGTH)
    bank_name?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxCodePoints(ACCOUNT_SHORT_FIELD_MAX_LENGTH)
    branch?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxCodePoints(ACCOUNT_SHORT_FIELD_MAX_LENGTH)
    account_number?: string | null;

  @IsOptionalNonNull()
  @IsSupportedCurrency()
    currency?: string;

  @IsOptionalNonNull()
  @IsLedgerDate()
    opening_date?: string;

  @IsOptionalNonNull()
  @IsString()
    opening_balance?: string;

  @IsOptional()
  @IsString()
  @MaxCodePoints(NOTES_MAX_LENGTH)
    notes?: string | null;
}
