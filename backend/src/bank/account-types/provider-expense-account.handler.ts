import { Injectable } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import type { AccountTypeContext, AccountTypeHandler } from './account-type-handler.js';
import {
  assertProviderExpensePairs,
  defaultProviderExpenseState,
  mergeProviderExpenseState,
  providerExpenseStateOf,
  rescaleProviderExpenseState,
  serializeProviderExpenseState,
  type ProviderExpenseResponse,
  type ProviderExpenseState,
} from './provider-expense-details.js';
import type { ProviderExpenseDetailsDto } from '../dto/provider-expense-details.dto.js';
import type { Account } from '../entities/account.entity.js';
import { ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';
import { todayUtc } from '../ledger-date.js';

/**
 * Handler of `provider_expense` accounts (see
 * `docs/agents/specs/banking/accounts/provider-expense.md`): a provider's
 * charges and payments on the regular ledger plus a 1:1
 * `bank_provider_expense_details` row, which every provider account has
 * (created with defaults when the body sends no `provider_expense` object).
 * PATCH merges the sent fields onto the stored row and checks the paired
 * `charge_frequency` ↔ `due_month` rule on the merged result.
 */
@Injectable()
export class ProviderExpenseAccountHandler implements AccountTypeHandler {
  readonly type = 'provider_expense';
  readonly carriesLedger = true;

  /**
   * No-op: provider-expense accounts have no account-level rule.
   * @returns {void}
   */
  validateAccount(): void {}

  /**
   * @param {unknown} nested - The validated `provider_expense` object, if any.
   * @param {AccountTypeContext} context - The new account's currency.
   * @returns {ProviderExpenseState} The details to insert.
   * @throws {BadRequestException} On an invalid amount or a broken paired rule.
   */
  validateCreate(nested: unknown, context: AccountTypeContext): ProviderExpenseState {
    return this.#merge(defaultProviderExpenseState(), nested, context.currency);
  }

  /**
   * @param {unknown} nested - The validated `provider_expense` object, if any.
   * @param {unknown} stored - The stored details row, if any.
   * @param {AccountTypeContext} context - The final and previous currency.
   * @returns {ProviderExpenseState} The merged details to save.
   * @throws {BadRequestException} On an invalid amount, an unrepresentable
   *   rescale, or a broken paired rule on the merged result.
   */
  validateUpdate(nested: unknown, stored: unknown, context: AccountTypeContext): ProviderExpenseState {
    let base = providerExpenseStateOf(stored as ProviderExpenseState | undefined);
    const replacesAmount = (nested as ProviderExpenseDetailsDto | undefined)?.expected_amount !== undefined;

    if (context.previousCurrency !== undefined && !replacesAmount) {
      base = rescaleProviderExpenseState(base, context.previousCurrency, context.currency);
    }

    return this.#merge(base, nested, context.currency);
  }

  /**
   * Loads the details rows in one query (no N+1).
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
   * Inserts or updates the account's details row.
   * @param {Account} account - The saved account.
   * @param {unknown} prepared - The {@link ProviderExpenseState} returned by the validate step.
   * @param {EntityManager} manager - The transactional entity manager.
   * @returns {Promise<void>}
   */
  async saveDetails(account: Account, prepared: unknown, manager: EntityManager): Promise<void> {
    const state = providerExpenseStateOf(prepared as ProviderExpenseState | undefined);

    await manager.getRepository(ProviderExpenseDetails).save({ ...state, accountId: account.id });
  }

  /**
   * @param {unknown} details - The loaded row, if any.
   * @param {Account} account - The account, for its currency.
   * @returns {ProviderExpenseResponse} The nested `provider_expense` object.
   */
  serialize(details: unknown, account: Account): ProviderExpenseResponse {
    return serializeProviderExpenseState(providerExpenseStateOf(details as ProviderExpenseState | undefined), account.currency);
  }

  #merge(base: ProviderExpenseState, nested: unknown, currency: string): ProviderExpenseState {
    const merged = nested === undefined ? base : mergeProviderExpenseState(base, nested as ProviderExpenseDetailsDto, currency, todayUtc(new Date()));
    assertProviderExpensePairs(merged);

    return merged;
  }
}
