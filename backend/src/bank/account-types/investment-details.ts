import { BadRequestException } from '@nestjs/common';
import { normaliseRate } from './rate.js';
import type { InvestmentDetailsDto } from '../dto/investment-details.dto.js';
import type { InvestmentDetails, InvestmentKind, InvestmentYieldPeriod } from '../entities/investment-details.entity.js';

// Pure helpers of the investment account type: defaults, PATCH merge, paired
// rule and serialization (see `docs/agents/specs/banking/accounts/investment.md`).

/** The investment fields of a `bank_investment_details` row (no key, no timestamps). */
export type InvestmentState = Pick<
  InvestmentDetails,
  'kind' | 'yieldRate' | 'yieldPeriod' | 'maturityDate' | 'liquidityDays'
>;

/**
 * The nested `investment` response object (snake_case). A type alias (not an
 * interface) so it stays assignable to the handler's `Record<string, unknown>`.
 */
export type InvestmentResponse = {
  kind: InvestmentKind | null;
  yield_rate: string | null;
  yield_period: InvestmentYieldPeriod | null;
  maturity_date: string | null;
  liquidity_days: number | null;
};

// Body key -> state property.
const COPIED_FIELDS = [
  ['kind', 'kind'],
  ['yield_rate', 'yieldRate'],
  ['yield_period', 'yieldPeriod'],
  ['maturity_date', 'maturityDate'],
  ['liquidity_days', 'liquidityDays'],
] as const;

/**
 * @returns {InvestmentState} The details of an investment created without an
 *   `investment` object: every field `null`.
 */
export function defaultInvestmentState(): InvestmentState {
  return { kind: null, yieldRate: null, yieldPeriod: null, maturityDate: null, liquidityDays: null };
}

/**
 * @param {InvestmentState | undefined} details - A loaded row (or any object carrying the investment fields).
 * @returns {InvestmentState} Only the investment fields, all `null` when there is no row.
 */
export function investmentStateOf(details: InvestmentState | undefined): InvestmentState {
  if (!details) {
    return defaultInvestmentState();
  }

  const { kind, yieldRate, yieldPeriod, maturityDate, liquidityDays } = details;

  return { kind, yieldRate, yieldPeriod, maturityDate, liquidityDays };
}

/**
 * Merges the sent `investment` fields onto `base` (`null` clears a field, an
 * absent one is unchanged).
 * @param {InvestmentState} base - The stored (or default) details.
 * @param {InvestmentDetailsDto} dto - The validated nested body.
 * @returns {InvestmentState} The merged details (a copy).
 */
export function mergeInvestmentState(base: InvestmentState, dto: InvestmentDetailsDto): InvestmentState {
  const merged: InvestmentState = { ...base };

  for (const [field, property] of COPIED_FIELDS) {
    if (dto[field] !== undefined) {
      Object.assign(merged, { [property]: dto[field] });
    }
  }

  return merged;
}

/**
 * Checks the paired rule on the (merged) details.
 * @param {InvestmentState} state - The details to check.
 * @returns {void}
 * @throws {BadRequestException} When `yield_rate` and `yield_period` are not
 *   both set or both unset.
 */
export function assertInvestmentPairs(state: InvestmentState): void {
  if ((state.yieldRate === null) !== (state.yieldPeriod === null)) {
    throw new BadRequestException('investment.yield_rate and investment.yield_period must be set together');
  }
}

/**
 * @param {InvestmentState} state - The details.
 * @returns {InvestmentResponse} The nested `investment` response object
 *   (unset fields `null`, `yield_rate` without trailing zeros).
 */
export function serializeInvestmentState(state: InvestmentState): InvestmentResponse {
  return {
    kind: state.kind,
    yield_rate: state.yieldRate === null ? null : normaliseRate(String(state.yieldRate)),
    yield_period: state.yieldPeriod,
    maturity_date: state.maturityDate,
    liquidity_days: state.liquidityDays,
  };
}
