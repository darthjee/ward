import { BadRequestException } from '@nestjs/common';
import { parseAmountInput } from './amount-input.js';
import type { OccurrenceKind } from './bill-schedule.js';
import { ErrorCodes } from '../core/error-codes.js';
import type { PayOccurrenceDto } from './dto/pay-occurrence.dto.js';

/** A validated pay / skip request. */
export type PaymentCommand =
  | { status: 'skipped' }
  | { status: 'paid'; paidOn: string; amount: bigint; payingAccountId: number; recordCharge: boolean };

const PAID_FIELDS = ['paid_on', 'amount', 'paying_account_id', 'record_charge'] as const;

/**
 * @param {string} message - The client-facing message.
 * @returns {BadRequestException} A 400 carrying `VALIDATION_FAILED`, like a DTO failure.
 */
function invalidBody(message: string): BadRequestException {
  return new BadRequestException({ code: ErrorCodes.VALIDATION_FAILED, message });
}

/**
 * Applies the conditional rules of a payment body:
 * - `skipped` accepts no other field;
 * - `paid` requires `paid_on`, `amount` (> 0, in the source currency) and
 *   `paying_account_id`; `record_charge` defaults to `true`, and is refused
 *   on a debt occurrence (debts record no charge).
 * @param {PayOccurrenceDto} dto - The validated body.
 * @param {OccurrenceKind} kind - The occurrence's kind.
 * @param {string} currency - The source account's currency.
 * @returns {PaymentCommand} The normalised command.
 * @throws {BadRequestException} 400 on a broken rule.
 */
export function paymentCommand(dto: PayOccurrenceDto, kind: OccurrenceKind, currency: string): PaymentCommand {
  if (dto.record_charge !== undefined && kind === 'debt') {
    throw invalidBody('record_charge is only accepted on provider occurrences');
  }

  if (dto.status === 'skipped') {
    const extra = PAID_FIELDS.find((field) => dto[field] !== undefined);
    if (extra) {
      throw invalidBody(`${extra} is not accepted when skipping`);
    }

    return { status: 'skipped' };
  }

  if (dto.paid_on === undefined || dto.amount === undefined || dto.paying_account_id === undefined) {
    throw invalidBody('paid_on, amount and paying_account_id are required when paying');
  }

  const amount = parseAmountInput('amount', dto.amount, currency);
  if (amount <= 0n) {
    throw invalidBody('amount must be greater than zero');
  }

  return {
    status: 'paid',
    paidOn: dto.paid_on,
    amount,
    payingAccountId: dto.paying_account_id,
    recordCharge: kind !== 'debt' && dto.record_charge !== false,
  };
}
