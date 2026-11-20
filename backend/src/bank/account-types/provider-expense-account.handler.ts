import { Injectable } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import type { AccountTypeContext, AccountTypeHandler } from './account-type-handler.js';
import { rescaleProviderBills } from './provider-bill-rescale.js';
import {
  defaultProviderExpenseState,
  mergeProviderExpenseState,
  providerExpenseStateOf,
  serializeProviderExpense,
  type ProviderExpenseResponse,
  type ProviderExpenseState,
} from './provider-expense-details.js';
import { formatAmount } from '../currency.js';
import type { ProviderExpenseDetailsDto } from '../dto/provider-expense-details.dto.js';
import type { Account } from '../entities/account.entity.js';
import { ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';
import { lockProvider } from '../provider-bill-checks.js';
import { ProviderBillsSummaryQuery } from '../provider-bills-summary.query.js';

// The previous currency learned by the validate step, keyed by the prepared
// state object (always a fresh one per request), so the state stays plain.
const PREVIOUS_CURRENCIES = new WeakMap<object, string>();

/**
 * Handler of `provider_expense` accounts (see
 * `docs/agents/modules/bank/provider-expense.md`): a provider's
 * charges and payments on the regular ledger plus a 1:1
 * `bank_provider_expense_details` row (`for_accountant`, `provider_tax_id`),
 * which every provider account has (created with defaults when the body sends
 * no `provider_expense` object). The schedule lives on the provider's bills.
 */
@Injectable()
export class ProviderExpenseAccountHandler implements AccountTypeHandler {
  readonly type = 'provider_expense';
  readonly carriesLedger = true;
  private readonly summaries: ProviderBillsSummaryQuery;

  /**
   * @param {ProviderBillsSummaryQuery} summaries - The grouped bill totals of the list's `bills_summary`.
   */
  constructor(summaries: ProviderBillsSummaryQuery) {
    this.summaries = summaries;
  }

  /**
   * No-op: provider-expense accounts have no account-level rule.
   * @returns {void}
   */
  validateAccount(): void {}

  /**
   * @param {unknown} nested - The validated `provider_expense` object, if any.
   * @returns {ProviderExpenseState} The details to insert.
   */
  validateCreate(nested: unknown): ProviderExpenseState {
    return this.#merge(defaultProviderExpenseState(), nested);
  }

  /**
   * @param {unknown} nested - The validated `provider_expense` object, if any.
   * @param {unknown} stored - The stored details row, if any.
   * @param {AccountTypeContext} context - The final and previous currency.
   * @returns {ProviderExpenseState} The merged details to save.
   */
  validateUpdate(nested: unknown, stored: unknown, context: AccountTypeContext): ProviderExpenseState {
    const prepared = this.#merge(providerExpenseStateOf(stored as ProviderExpenseState | undefined), nested);

    if (context.previousCurrency !== undefined) {
      PREVIOUS_CURRENCIES.set(prepared, context.previousCurrency);
    }

    return prepared;
  }

  /**
   * Loads the details rows in one query.
   * @param {number[]} accountIds - The provider-expense accounts.
   * @param {EntityManager} manager - The entity manager.
   * @returns {Promise<Map<number, unknown>>} The rows keyed by account id.
   */
  async loadDetails(accountIds: number[], manager: EntityManager): Promise<Map<number, unknown>> {
    if (accountIds.length === 0) {
      return new Map();
    }

    const rows = await manager.getRepository(ProviderExpenseDetails).find({ where: { accountId: In(accountIds) } });

    return new Map(rows.map((row) => [row.accountId, row]));
  }

  /**
   * Inserts or updates the account's details row, in the caller's
   * transaction. A currency change also rescales every bill of the provider
   * (both kinds) and re-checks their paying accounts, under the provider lock.
   * @param {Account} account - The saved account.
   * @param {unknown} prepared - The {@link ProviderExpenseState} returned by the validate step.
   * @param {EntityManager} manager - The transactional entity manager.
   * @returns {Promise<void>}
   * @throws {BadRequestException} When a bill amount cannot be represented in the new currency.
   * @throws {UnprocessableEntityException} When a bill's paying account does not fit the new currency.
   */
  async saveDetails(account: Account, prepared: unknown, manager: EntityManager): Promise<void> {
    const state = providerExpenseStateOf(prepared as ProviderExpenseState | undefined);
    const previousCurrency = PREVIOUS_CURRENCIES.get(prepared as object);

    await manager.getRepository(ProviderExpenseDetails).save({ ...state, accountId: account.id });

    if (previousCurrency !== undefined && previousCurrency !== account.currency) {
      await lockProvider(manager, account.id);
      await rescaleProviderBills(account, previousCurrency, manager);
    }
  }

  /**
   * @param {unknown} details - The loaded row, if any.
   * @returns {ProviderExpenseResponse} The nested `provider_expense` object.
   */
  serialize(details: unknown): ProviderExpenseResponse {
    return serializeProviderExpense(details as ProviderExpenseState | undefined);
  }

  /**
   * List only: every provider's `bills_summary` from one grouped query.
   * `count` covers every bill; `monthly`/`yearly` sum the recurring bills'
   * `expected_amount` in the account's currency (zero when there is none).
   * @param {Account[]} accounts - The listed provider-expense accounts.
   * @returns {Promise<Map<number, Record<string, unknown>>>} `{ bills_summary }` keyed by account id.
   */
  async listExtras(accounts: Account[]): Promise<Map<number, Record<string, unknown>>> {
    const summaries = await this.summaries.summaries(accounts.map(({ id }) => id));

    return new Map(accounts.map((account) => {
      const { count, monthly, yearly } = summaries.get(account.id) ?? { count: 0, monthly: 0n, yearly: 0n };

      return [account.id, {
        bills_summary: {
          count,
          monthly: formatAmount(monthly, account.currency),
          yearly: formatAmount(yearly, account.currency),
        },
      }];
    }));
  }

  #merge(base: ProviderExpenseState, nested: unknown): ProviderExpenseState {
    return nested === undefined ? base : mergeProviderExpenseState(base, nested as ProviderExpenseDetailsDto);
  }
}
