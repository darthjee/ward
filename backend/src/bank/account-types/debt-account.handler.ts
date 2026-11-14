import { Injectable } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import type { AccountTypeContext, AccountTypeHandler } from './account-type-handler.js';
import type { WithPayingAccount } from './schedule-fields.js';
import { withPayingAccounts } from '../account-refs.js';
import {
  assertDebtPairs,
  debtStateOf,
  defaultDebtState,
  mergeDebtState,
  rescaleDebtState,
  serializeDebtState,
  type DebtResponse,
  type DebtState,
} from './debt-details.js';
import type { DebtDetailsDto } from '../dto/debt-details.dto.js';
import type { Account } from '../entities/account.entity.js';
import { DebtDetails } from '../entities/debt-details.entity.js';
import { todayUtc } from '../ledger-date.js';

/**
 * Handler of `debt` accounts (see `docs/agents/modules/bank/debt.md`):
 * a loan with the regular ledger plus a 1:1 `bank_debt_details` row, which
 * every debt account has (created with defaults when the body sends no
 * `debt` object). PATCH merges the sent `debt` fields onto the stored row and
 * checks the paired rules on the merged result.
 */
@Injectable()
export class DebtAccountHandler implements AccountTypeHandler {
  readonly type = 'debt';
  readonly carriesLedger = true;

  /**
   * No-op: debt accounts have no account-level rule.
   * @returns {void}
   */
  validateAccount(): void {}

  /**
   * @param {unknown} nested - The validated `debt` object, if any.
   * @param {AccountTypeContext} context - The new account's currency.
   * @returns {DebtState} The details to insert.
   * @throws {BadRequestException} On an invalid amount or a broken paired rule.
   */
  validateCreate(nested: unknown, context: AccountTypeContext): DebtState {
    return this.#merge(defaultDebtState(), nested, context.currency);
  }

  /**
   * @param {unknown} nested - The validated `debt` object, if any.
   * @param {unknown} stored - The stored details row, if any.
   * @param {AccountTypeContext} context - The final and previous currency.
   * @returns {DebtState} The merged details to save.
   * @throws {BadRequestException} On an invalid amount, an unrepresentable
   *   rescale, or a broken paired rule on the merged result.
   */
  validateUpdate(nested: unknown, stored: unknown, context: AccountTypeContext): DebtState {
    let base = debtStateOf(stored as DebtState | undefined);
    const replacesAmount = (nested as DebtDetailsDto | undefined)?.instalment_amount !== undefined;

    if (context.previousCurrency !== undefined && !replacesAmount) {
      base = rescaleDebtState(base, context.previousCurrency, context.currency);
    }

    return this.#merge(base, nested, context.currency);
  }

  /**
   * Loads the details rows in one query, plus one for their default paying
   * accounts' names (no N+1).
   * @param {number[]} accountIds - The debt accounts.
   * @param {EntityManager} manager - The entity manager.
   * @returns {Promise<Map<number, unknown>>} The rows keyed by account id.
   */
  async loadDetails(accountIds: number[], manager: EntityManager): Promise<Map<number, unknown>> {
    if (accountIds.length === 0) {
      return new Map();
    }

    const rows = await manager.getRepository(DebtDetails).find({ where: { accountId: In(accountIds) } });

    return new Map((await withPayingAccounts(rows, manager)).map((row) => [row.accountId, row]));
  }

  /**
   * Inserts or updates the account's details row.
   * @param {Account} account - The saved account.
   * @param {unknown} prepared - The {@link DebtState} returned by the validate step.
   * @param {EntityManager} manager - The transactional entity manager.
   * @returns {Promise<void>}
   */
  async saveDetails(account: Account, prepared: unknown, manager: EntityManager): Promise<void> {
    const state = debtStateOf(prepared as DebtState | undefined);

    await manager.getRepository(DebtDetails).save({ ...state, accountId: account.id });
  }

  /**
   * @param {unknown} details - The loaded row, if any.
   * @param {Account} account - The account, for its currency.
   * @returns {DebtResponse} The nested `debt` object.
   */
  serialize(details: unknown, account: Account): DebtResponse {
    const loaded = details as (DebtState & WithPayingAccount) | undefined;

    return serializeDebtState(debtStateOf(loaded), account.currency, loaded?.payingAccount ?? null);
  }

  #merge(base: DebtState, nested: unknown, currency: string): DebtState {
    const merged = nested === undefined ? base : mergeDebtState(base, nested as DebtDetailsDto, currency, todayUtc(new Date()));
    assertDebtPairs(merged);

    return merged;
  }
}
