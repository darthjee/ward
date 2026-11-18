import { BadRequestException } from '@nestjs/common';
import { parseAmountInput } from './amount-input.js';
import type { UpdateProviderBillDto } from './dto/update-provider-bill.dto.js';
import type { ProviderBill, ProviderBillKind } from './entities/provider-bill.entity.js';

// Pure merged-state rules of a provider bill (see
// `docs/agents/specs/split-provider/model.md`, bill matrix).

/** The mutable columns of a provider bill (no key, kind, provider or timestamps). */
export type ProviderBillFields = Pick<
  ProviderBill,
  | 'description' | 'notes' | 'payingAccountId' | 'expectedAmount' | 'dueDate'
  | 'chargeFrequency' | 'dueDay' | 'dueMonth' | 'billsFrom' | 'showInCalendar'
>;

/** The body fields shared by create and update (everything but `kind` and the provider). */
export type ProviderBillInput = Omit<UpdateProviderBillDto, 'kind' | 'provider_account_id'>;

const RECURRING_KEYS = ['chargeFrequency', 'dueDay', 'dueMonth', 'billsFrom', 'showInCalendar'] as const;

/**
 * @param {ProviderBillKind} kind - The kind of the new bill.
 * @param {string} today - Today (UTC), `YYYY-MM-DD`.
 * @returns {ProviderBillFields} The defaults of a new bill of that kind.
 */
export function defaultProviderBillFields(kind: ProviderBillKind, today: string): ProviderBillFields {
  const recurring = kind === 'recurring';

  return {
    description: '',
    notes: null,
    payingAccountId: null,
    expectedAmount: null,
    dueDate: null,
    chargeFrequency: recurring ? 'monthly' : null,
    dueDay: null,
    dueMonth: null,
    billsFrom: recurring ? today : null,
    showInCalendar: recurring ? true : null,
  };
}

/**
 * @param {ProviderBill} bill - A stored bill.
 * @returns {ProviderBillFields} Only its mutable columns.
 */
export function providerBillFieldsOf(bill: ProviderBill): ProviderBillFields {
  const { description, notes, payingAccountId, expectedAmount, dueDate, chargeFrequency, dueDay, dueMonth, billsFrom, showInCalendar } = bill;

  return { description, notes, payingAccountId, expectedAmount, dueDate, chargeFrequency, dueDay, dueMonth, billsFrom, showInCalendar };
}

const COPIED = [
  ['description', 'description'],
  ['notes', 'notes'],
  ['paying_account_id', 'payingAccountId'],
  ['due_date', 'dueDate'],
  ['charge_frequency', 'chargeFrequency'],
  ['due_day', 'dueDay'],
  ['due_month', 'dueMonth'],
  ['bills_from', 'billsFrom'],
  ['show_in_calendar', 'showInCalendar'],
] as const;

function parseExpected(value: string, currency: string): bigint {
  const amount = parseAmountInput('expected_amount', value, currency);

  if (amount <= 0n) {
    throw new BadRequestException('expected_amount must be greater than zero');
  }

  return amount;
}

function assertOneOff(fields: ProviderBillFields): void {
  if (RECURRING_KEYS.some((key) => fields[key] !== null)) {
    throw new BadRequestException('a one_off bill does not accept charge_frequency, due_day, due_month, bills_from or show_in_calendar');
  }

  if (fields.dueDate === null) {
    throw new BadRequestException('due_date is required for a one_off bill');
  }

  if (fields.expectedAmount === null) {
    throw new BadRequestException('expected_amount is required for a one_off bill');
  }
}

function assertRecurring(fields: ProviderBillFields): void {
  if (fields.dueDate !== null) {
    throw new BadRequestException('a recurring bill does not accept due_date');
  }

  if (fields.dueDay === null) {
    throw new BadRequestException('due_day is required for a recurring bill');
  }

  if (fields.chargeFrequency === null || fields.billsFrom === null || fields.showInCalendar === null) {
    throw new BadRequestException('charge_frequency, bills_from and show_in_calendar cannot be null on a recurring bill');
  }

  if (fields.chargeFrequency === 'yearly' && fields.dueMonth === null) {
    throw new BadRequestException('due_month is required with a yearly charge_frequency');
  }
}

/**
 * Merges the sent fields onto `base` (`null` clears a nullable field, an
 * absent one is unchanged) and checks the per-kind matrix on the result.
 * A merged `monthly` frequency clears `due_month`, unless the request sends a
 * non-null one (400).
 * @param {ProviderBillKind} kind - The bill kind.
 * @param {ProviderBillFields} base - The stored (or default) fields.
 * @param {ProviderBillInput} input - The validated body.
 * @param {string} currency - The provider account's currency.
 * @returns {ProviderBillFields} The merged fields.
 * @throws {BadRequestException} When the merged state breaks the matrix or an amount is invalid.
 */
export function mergeProviderBillFields(
  kind: ProviderBillKind,
  base: ProviderBillFields,
  input: ProviderBillInput,
  currency: string,
): ProviderBillFields {
  const merged: ProviderBillFields = { ...base };

  for (const [field, property] of COPIED) {
    if (input[field] !== undefined) {
      Object.assign(merged, { [property]: input[field] });
    }
  }

  if (input.expected_amount !== undefined) {
    merged.expectedAmount = input.expected_amount === null ? null : parseExpected(input.expected_amount, currency);
  }

  if (merged.chargeFrequency === 'monthly') {
    if (input.due_month !== undefined && input.due_month !== null) {
      throw new BadRequestException('due_month is only accepted with a yearly charge_frequency');
    }

    merged.dueMonth = null;
  }

  if (kind === 'recurring') {
    assertRecurring(merged);
  } else {
    assertOneOff(merged);
  }

  return merged;
}
