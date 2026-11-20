import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { IsOptionalNonNull, PROVIDER_TAX_ID_MAX_LENGTH, trimToNull } from './field-validators.js';
import { MaxCodePoints } from '../../core/string-validators.js';

/**
 * The nested `provider_expense` object of an account body (see
 * `docs/agents/modules/bank/provider-expense.md`): only `for_accountant` and
 * `provider_tax_id` (`null` clears it). The schedule lives on provider bills
 * (`/provider-bills.json`); any other key, schedule fields included, answers
 * 400 through the strict pipe's whitelist.
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
}
