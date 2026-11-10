import { BadRequestException } from '@nestjs/common';
import { convertAmountInput, parseAmountInput } from '../amount-input.js';
import {
  applyBillsFromLifecycle,
  defaultScheduleState,
  SCHEDULE_COPIED_FIELDS,
  scheduleStateOf,
  serializeScheduleFields,
  type ScheduleResponse,
  type ScheduleState,
} from './schedule-fields.js';
import type { AccountRef } from '../account-refs.js';
import { formatAmount } from '../currency.js';
import type { ProviderExpenseDetailsDto } from '../dto/provider-expense-details.dto.js';
import type { ProviderChargeFrequency, ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';

// Pure helpers of the provider-expense account type: defaults, PATCH merge,
// paired rule, currency rescale and serialization (see
// `docs/agents/specs/banking/accounts/provider-expense.md`).

/** The provider-expense fields of a `bank_provider_expense_details` row (no key, no timestamps). */
export type ProviderExpenseState = Pick<
  ProviderExpenseDetails,
  'forAccountant' | 'providerTaxId' | 'expectedAmount' | 'dueDay' | 'chargeFrequency' | 'dueMonth'
> & ScheduleState;

/**
 * The nested `provider_expense` response object (snake_case). A type alias
 * (not an interface) so it stays assignable to the handler's
 * `Record<string, unknown>`.
 */
export type ProviderExpenseResponse = {
  for_accountant: boolean;
  provider_tax_id: string | null;
  expected_amount: string | null;
  charge_frequency: ProviderChargeFrequency;
  due_day: number | null;
  due_month: number | null;
} & ScheduleResponse;

/** The body field named in `expected_amount` errors. */
export const EXPECTED_AMOUNT_FIELD = 'provider_expense.expected_amount';

// Plain-copy fields: body key -> state property (`expected_amount` needs parsing).
const COPIED_FIELDS = [
  ['for_accountant', 'forAccountant'],
  ['provider_tax_id', 'providerTaxId'],
  ['due_day', 'dueDay'],
  ['charge_frequency', 'chargeFrequency'],
  ['due_month', 'dueMonth'],
  ...SCHEDULE_COPIED_FIELDS,
] as const;

/**
 * @returns {ProviderExpenseState} The details of a provider account created
 *   without a `provider_expense` object: `for_accountant` `true`,
 *   `charge_frequency` `monthly`, every other field `null`.
 */
export function defaultProviderExpenseState(): ProviderExpenseState {
  return {
    forAccountant: true,
    providerTaxId: null,
    expectedAmount: null,
    dueDay: null,
    chargeFrequency: 'monthly',
    dueMonth: null,
    ...defaultScheduleState(),
  };
}

/**
 * @param {ProviderExpenseState | undefined} details - A loaded row (or any
 *   object carrying the provider-expense fields).
 * @returns {ProviderExpenseState} Only the provider-expense fields, defaults
 *   when there is no row.
 */
export function providerExpenseStateOf(details: ProviderExpenseState | undefined): ProviderExpenseState {
  if (!details) {
    return defaultProviderExpenseState();
  }

  const { forAccountant, providerTaxId, expectedAmount, dueDay, chargeFrequency, dueMonth } = details;

  return { forAccountant, providerTaxId, expectedAmount, dueDay, chargeFrequency, dueMonth, ...scheduleStateOf(details) };
}

/**
 * Parses a `provider_expense.expected_amount` into minor units of `currency`.
 * @param {string} value - The decimal string.
 * @param {string} currency - The account's (final) currency.
 * @returns {bigint} The amount, in minor units.
 * @throws {BadRequestException} When malformed, with too many decimals, over
 *   the amount bound, or not strictly positive.
 */
export function parseExpectedAmount(value: string, currency: string): bigint {
  const amount = parseAmountInput(EXPECTED_AMOUNT_FIELD, value, currency);

  if (amount <= 0n) {
    throw new BadRequestException(`${EXPECTED_AMOUNT_FIELD} must be greater than zero`);
  }

  return amount;
}

/**
 * Re-expresses the stored `expectedAmount` in a new currency's exponent,
 * keeping its decimal value, exactly like `opening_balance`.
 * @param {ProviderExpenseState} state - The stored details.
 * @param {string} from - The current currency.
 * @param {string} to - The new currency.
 * @returns {ProviderExpenseState} The rescaled details (a copy).
 * @throws {BadRequestException} When the amount cannot be represented in `to`
 *   (e.g. `12.50` BRL to JPY).
 */
export function rescaleProviderExpenseState(state: ProviderExpenseState, from: string, to: string): ProviderExpenseState {
  if (state.expectedAmount === null || from === to) {
    return { ...state };
  }

  return { ...state, expectedAmount: convertAmountInput(EXPECTED_AMOUNT_FIELD, state.expectedAmount, from, to) };
}

/**
 * Merges the sent `provider_expense` fields onto `base` (`null` clears a
 * field, an absent one is unchanged). A merged `monthly` frequency clears
 * `due_month`, unless the request sends a non-null `due_month` (→ 400).
 * Setting `due_day` for the first time sets an unset, unsent `bills_from` to
 * `today`.
 * @param {ProviderExpenseState} base - The stored (or default) details.
 * @param {ProviderExpenseDetailsDto} dto - The validated nested body.
 * @param {string} currency - The account's (final) currency.
 * @param {string} today - Today (UTC), `YYYY-MM-DD`.
 * @returns {ProviderExpenseState} The merged details.
 * @throws {BadRequestException} When `expected_amount` is invalid, or
 *   `due_month` is sent with a `monthly` frequency.
 */
export function mergeProviderExpenseState(
  base: ProviderExpenseState,
  dto: ProviderExpenseDetailsDto,
  currency: string,
  today: string,
): ProviderExpenseState {
  const merged: ProviderExpenseState = { ...base };

  for (const [field, property] of COPIED_FIELDS) {
    if (dto[field] !== undefined) {
      Object.assign(merged, { [property]: dto[field] });
    }
  }

  if (dto.expected_amount !== undefined) {
    merged.expectedAmount = dto.expected_amount === null ? null : parseExpectedAmount(dto.expected_amount, currency);
  }

  if (merged.chargeFrequency === 'monthly') {
    if (dto.due_month !== undefined && dto.due_month !== null) {
      throw new BadRequestException('provider_expense.due_month is only accepted with a yearly charge_frequency');
    }

    merged.dueMonth = null;
  }

  applyBillsFromLifecycle(base, merged, dto, today);

  return merged;
}

/**
 * Checks the paired rule on the (merged) details.
 * @param {ProviderExpenseState} state - The details to check.
 * @returns {void}
 * @throws {BadRequestException} When a `yearly` frequency has no `due_month`.
 */
export function assertProviderExpensePairs(state: ProviderExpenseState): void {
  if (state.chargeFrequency === 'yearly' && state.dueMonth === null) {
    throw new BadRequestException('provider_expense.due_month is required with a yearly charge_frequency');
  }
}

/**
 * @param {ProviderExpenseState} state - The details.
 * @param {string} currency - The account currency.
 * @param {AccountRef | null} [payingAccount] - The default paying account's ref, if loaded.
 * @returns {ProviderExpenseResponse} The nested `provider_expense` response object.
 */
export function serializeProviderExpenseState(
  state: ProviderExpenseState,
  currency: string,
  payingAccount: AccountRef | null = null,
): ProviderExpenseResponse {
  return {
    for_accountant: state.forAccountant,
    provider_tax_id: state.providerTaxId,
    expected_amount: state.expectedAmount === null ? null : formatAmount(state.expectedAmount, currency),
    charge_frequency: state.chargeFrequency,
    due_day: state.dueDay,
    due_month: state.dueMonth,
    ...serializeScheduleFields(state, payingAccount),
  };
}
