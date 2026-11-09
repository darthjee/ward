import { Transform, Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { DebtDetailsDto } from './debt-details.dto.js';
import {
  ACCOUNT_NAME_MAX_LENGTH,
  ACCOUNT_SHORT_FIELD_MAX_LENGTH,
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
 * Request body for `PATCH <base>/accounts/:accountId.json`, taken through
 * `@StrictBody()`. Every field is optional; `type` is not declared (fixed
 * after creation), so sending it answers 400, as do owner fields, ids and
 * computed fields. On an archived account only `name` is accepted, and
 * `currency` is locked once the account has transactions (both 409, checked
 * by the service).
 */
export class UpdateAccountDto {
  @IsOptionalNonNull()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(ACCOUNT_NAME_MAX_LENGTH)
    name?: string;

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
