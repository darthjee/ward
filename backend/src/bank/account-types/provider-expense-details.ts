import type { ProviderExpenseDetailsDto } from '../dto/provider-expense-details.dto.js';
import type { ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';

// Pure helpers of the provider-expense account type: defaults, PATCH merge and
// serialization (see `docs/agents/modules/bank/provider-expense.md`). The
// schedule lives on the provider's bills, never on the details row.

/** The provider-expense fields of a `bank_provider_expense_details` row (no key, no timestamps). */
export type ProviderExpenseState = Pick<ProviderExpenseDetails, 'forAccountant' | 'providerTaxId'>;

/**
 * The nested `provider_expense` response object (snake_case). A type alias
 * (not an interface) so it stays assignable to the handler's
 * `Record<string, unknown>`.
 */
export type ProviderExpenseResponse = {
  for_accountant: boolean;
  provider_tax_id: string | null;
};

// Plain-copy fields: body key -> state property.
const COPIED_FIELDS = [
  ['for_accountant', 'forAccountant'],
  ['provider_tax_id', 'providerTaxId'],
] as const;

/**
 * @returns {ProviderExpenseState} The details of a provider account created
 *   without a `provider_expense` object: `for_accountant` `true`, no tax id.
 */
export function defaultProviderExpenseState(): ProviderExpenseState {
  return { forAccountant: true, providerTaxId: null };
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

  const { forAccountant, providerTaxId } = details;

  return { forAccountant, providerTaxId };
}

/**
 * Merges the sent `provider_expense` fields onto `base` (`null` clears
 * `provider_tax_id`, an absent field is unchanged).
 * @param {ProviderExpenseState} base - The stored (or default) details.
 * @param {ProviderExpenseDetailsDto} dto - The validated nested body.
 * @returns {ProviderExpenseState} The merged details.
 */
export function mergeProviderExpenseState(base: ProviderExpenseState, dto: ProviderExpenseDetailsDto): ProviderExpenseState {
  const merged: ProviderExpenseState = { ...base };

  for (const [field, property] of COPIED_FIELDS) {
    if (dto[field] !== undefined) {
      Object.assign(merged, { [property]: dto[field] });
    }
  }

  return merged;
}

/**
 * @param {ProviderExpenseState | undefined} details - The loaded details row, if any.
 * @returns {ProviderExpenseResponse} The nested `provider_expense` response object.
 */
export function serializeProviderExpense(details: ProviderExpenseState | undefined): ProviderExpenseResponse {
  const state = providerExpenseStateOf(details);

  return { for_accountant: state.forAccountant, provider_tax_id: state.providerTaxId };
}
