import { IsBoolean, IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { IsLedgerDate, IsOptionalNonNull, MAX_INT_COLUMN } from './field-validators.js';
import type { BillPaymentStatus } from '../entities/bill-payment.entity.js';

/**
 * Request body of the pay / skip routes (see `docs/agents/specs/banking/bills.md`,
 * *Validation*), taken through `@StrictBody()`: unknown fields answer 400.
 * Only formats are checked here; which fields a `paid` / `skipped` body
 * requires or refuses, and `record_charge` on a debt, are checked by
 * `paymentCommand()` once the occurrence's kind is known.
 */
export class PayOccurrenceDto {
  @IsIn(['paid', 'skipped'])
    status!: BillPaymentStatus;

  @IsOptionalNonNull()
  @IsLedgerDate()
    paid_on?: string;

  @IsOptionalNonNull()
  @IsString()
    amount?: string;

  @IsOptionalNonNull()
  @IsInt()
  @Min(1)
  @Max(MAX_INT_COLUMN)
    paying_account_id?: number;

  @IsOptionalNonNull()
  @IsBoolean()
    record_charge?: boolean;
}
