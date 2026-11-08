import { BadRequestException } from '@nestjs/common';
import { convertAmountInput, parseAmountInput } from '../amount-input.js';
import { formatAmount } from '../currency.js';
import type { DebtDetailsDto } from '../dto/debt-details.dto.js';
import type { DebtDetails, DebtPeriod } from '../entities/debt-details.entity.js';

// Pure helpers of the debt account type: defaults, PATCH merge, paired rules,
// currency rescale and serialization (see `docs/agents/specs/banking/accounts/debt.md`).

/** The debt fields of a `bank_debt_details` row (no key, no timestamps). */
export type DebtState = Pick<
  DebtDetails,
  'interestRate' | 'interestPeriod' | 'instalmentAmount' | 'instalmentFrequency' | 'dueDay' | 'dueMonth' | 'instalmentCount'
>;

/**
 * The nested `debt` response object (snake_case). A type alias (not an
 * interface) so it stays assignable to the handler's `Record<string, unknown>`.
 */
export type DebtResponse = {
  interest_rate: string | null;
  interest_period: DebtPeriod | null;
  instalment_amount: string | null;
  instalment_frequency: DebtPeriod;
  due_day: number | null;
  due_month: number | null;
  instalment_count: number | null;
};

/** The body field named in `instalment_amount` errors. */
export const INSTALMENT_AMOUNT_FIELD = 'debt.instalment_amount';

// Plain-copy fields: body key -> state property (`instalment_amount` needs parsing).
const COPIED_FIELDS = [
  ['interest_rate', 'interestRate'],
  ['interest_period', 'interestPeriod'],
  ['instalment_frequency', 'instalmentFrequency'],
  ['due_day', 'dueDay'],
  ['due_month', 'dueMonth'],
  ['instalment_count', 'instalmentCount'],
] as const;

/**
 * @returns {DebtState} The details of a debt created without a `debt` object:
 *   every field `null`, `instalment_frequency` `monthly`.
 */
export function defaultDebtState(): DebtState {
  return {
    interestRate: null,
    interestPeriod: null,
    instalmentAmount: null,
    instalmentFrequency: 'monthly',
    dueDay: null,
    dueMonth: null,
    instalmentCount: null,
  };
}

/**
 * @param {DebtState | undefined} details - A loaded row (or any object carrying the debt fields).
 * @returns {DebtState} Only the debt fields, defaults when there is no row.
 */
export function debtStateOf(details: DebtState | undefined): DebtState {
  if (!details) {
    return defaultDebtState();
  }

  const { interestRate, interestPeriod, instalmentAmount, instalmentFrequency, dueDay, dueMonth, instalmentCount } = details;

  return { interestRate, interestPeriod, instalmentAmount, instalmentFrequency, dueDay, dueMonth, instalmentCount };
}

/**
 * Parses a `debt.instalment_amount` into minor units of `currency`.
 * @param {string} value - The decimal string.
 * @param {string} currency - The account's (final) currency.
 * @returns {bigint} The amount, in minor units.
 * @throws {BadRequestException} When malformed, with too many decimals, over
 *   the amount bound, or not strictly positive.
 */
export function parseInstalmentAmount(value: string, currency: string): bigint {
  const amount = parseAmountInput(INSTALMENT_AMOUNT_FIELD, value, currency);

  if (amount <= 0n) {
    throw new BadRequestException(`${INSTALMENT_AMOUNT_FIELD} must be greater than zero`);
  }

  return amount;
}

/**
 * Re-expresses the stored `instalmentAmount` in a new currency's exponent,
 * keeping its decimal value, exactly like `opening_balance`.
 * @param {DebtState} state - The stored details.
 * @param {string} from - The current currency.
 * @param {string} to - The new currency.
 * @returns {DebtState} The rescaled details (a copy).
 * @throws {BadRequestException} When the amount cannot be represented in `to`
 *   (e.g. `12.50` BRL to JPY).
 */
export function rescaleDebtState(state: DebtState, from: string, to: string): DebtState {
  if (state.instalmentAmount === null || from === to) {
    return { ...state };
  }

  return { ...state, instalmentAmount: convertAmountInput(INSTALMENT_AMOUNT_FIELD, state.instalmentAmount, from, to) };
}

/**
 * Merges the sent `debt` fields onto `base` (`null` clears a field, an absent
 * one is unchanged). A merged `monthly` frequency clears `due_month`, unless
 * the request sends a non-null `due_month` (→ 400).
 * @param {DebtState} base - The stored (or default) details.
 * @param {DebtDetailsDto} dto - The validated nested body.
 * @param {string} currency - The account's (final) currency.
 * @returns {DebtState} The merged details.
 * @throws {BadRequestException} When `instalment_amount` is invalid, or
 *   `due_month` is sent with a `monthly` frequency.
 */
export function mergeDebtState(base: DebtState, dto: DebtDetailsDto, currency: string): DebtState {
  const merged: DebtState = { ...base };

  for (const [field, property] of COPIED_FIELDS) {
    if (dto[field] !== undefined) {
      Object.assign(merged, { [property]: dto[field] });
    }
  }

  if (dto.instalment_amount !== undefined) {
    merged.instalmentAmount = dto.instalment_amount === null ? null : parseInstalmentAmount(dto.instalment_amount, currency);
  }

  if (merged.instalmentFrequency === 'monthly') {
    if (dto.due_month !== undefined && dto.due_month !== null) {
      throw new BadRequestException('debt.due_month is only accepted with a yearly instalment_frequency');
    }

    merged.dueMonth = null;
  }

  return merged;
}

/**
 * Checks the paired rules on the (merged) details.
 * @param {DebtState} state - The details to check.
 * @returns {void}
 * @throws {BadRequestException} When `interest_rate` and `interest_period`
 *   are not both set or both unset, or a `yearly` frequency has no `due_month`.
 */
export function assertDebtPairs(state: DebtState): void {
  if ((state.interestRate === null) !== (state.interestPeriod === null)) {
    throw new BadRequestException('debt.interest_rate and debt.interest_period must be set together');
  }

  if (state.instalmentFrequency === 'yearly' && state.dueMonth === null) {
    throw new BadRequestException('debt.due_month is required with a yearly instalment_frequency');
  }
}

/**
 * Normalises a `DECIMAL(7,4)` rate by stripping trailing fractional zeros
 * (`"1.9900"` → `"1.99"`, `"0.0000"` → `"0"`, `"100.0000"` → `"100"`).
 * @param {string} rate - The stored rate.
 * @returns {string} The normalised decimal string.
 */
export function normaliseRate(rate: string): string {
  return rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate;
}

/**
 * @param {DebtState} state - The details.
 * @param {string} currency - The account currency.
 * @returns {DebtResponse} The nested `debt` response object.
 */
export function serializeDebtState(state: DebtState, currency: string): DebtResponse {
  return {
    interest_rate: state.interestRate === null ? null : normaliseRate(String(state.interestRate)),
    interest_period: state.interestPeriod,
    instalment_amount: state.instalmentAmount === null ? null : formatAmount(state.instalmentAmount, currency),
    instalment_frequency: state.instalmentFrequency,
    due_day: state.dueDay,
    due_month: state.dueMonth,
    instalment_count: state.instalmentCount,
  };
}
