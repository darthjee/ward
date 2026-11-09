import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { DebtDetailsDto } from './debt-details.dto.js';
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
import { InvestmentDetailsDto } from './investment-details.dto.js';
import { ProviderExpenseDetailsDto } from './provider-expense-details.dto.js';
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

  /** Debt details; only meaningful on a `debt` account (checked by the handler). */
  @IsOptionalNonNull()
  @IsObject()
  @ValidateNested()
  @Type(() => DebtDetailsDto)
    debt?: DebtDetailsDto;

  /** Investment details; only meaningful on an `investment` account (checked by the handler). */
  @IsOptionalNonNull()
  @IsObject()
  @ValidateNested()
  @Type(() => InvestmentDetailsDto)
    investment?: InvestmentDetailsDto;

  /** Provider-expense details; only meaningful on a `provider_expense` account (checked by the handler). */
  @IsOptionalNonNull()
  @IsObject()
  @ValidateNested()
  @Type(() => ProviderExpenseDetailsDto)
    provider_expense?: ProviderExpenseDetailsDto;
}
