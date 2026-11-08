import { BadRequestException, Injectable } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import type { AccountTypeHandler } from './account-type-handler.js';
import {
  assertInvestmentPairs,
  defaultInvestmentState,
  investmentStateOf,
  mergeInvestmentState,
  serializeInvestmentState,
  type InvestmentResponse,
  type InvestmentState,
} from './investment-details.js';
import type { InvestmentDetailsDto } from '../dto/investment-details.dto.js';
import type { Account } from '../entities/account.entity.js';
import { InvestmentDetails } from '../entities/investment-details.entity.js';

/**
 * Handler of `investment` accounts (see
 * `docs/agents/specs/banking/accounts/investment.md`): one investment with
 * the regular ledger (its balance is the current value) plus a 1:1
 * `bank_investment_details` row, which every investment account has (all
 * fields `null` when the body sends no `investment` object). Its opening
 * balance is always 0. PATCH merges the sent `investment` fields onto the
 * stored row and checks the paired rule on the merged result.
 */
@Injectable()
export class InvestmentAccountHandler implements AccountTypeHandler {
  readonly type = 'investment';
  readonly carriesLedger = true;

  /**
   * An investment always starts empty: its opening balance must be 0.
   * @param {Account} account - The account with the request applied.
   * @returns {void}
   * @throws {BadRequestException} When `openingBalance` is not 0.
   */
  validateAccount(account: Account): void {
    if (account.openingBalance !== 0n) {
      throw new BadRequestException('opening_balance must be 0 on investment accounts');
    }
  }

  /**
   * @param {unknown} nested - The validated `investment` object, if any.
   * @returns {InvestmentState} The details to insert.
   * @throws {BadRequestException} When the paired rule is broken.
   */
  validateCreate(nested: unknown): InvestmentState {
    return this.#merge(defaultInvestmentState(), nested);
  }

  /**
   * @param {unknown} nested - The validated `investment` object, if any.
   * @param {unknown} stored - The stored details row, if any.
   * @returns {InvestmentState} The merged details to save.
   * @throws {BadRequestException} When the paired rule is broken on the merged result.
   */
  validateUpdate(nested: unknown, stored: unknown): InvestmentState {
    return this.#merge(investmentStateOf(stored as InvestmentState | undefined), nested);
  }

  /**
   * Loads the details rows in one query (no N+1).
   * @param {number[]} accountIds - The investment accounts.
   * @param {EntityManager} manager - The entity manager.
   * @returns {Promise<Map<number, unknown>>} The rows keyed by account id.
   */
  async loadDetails(accountIds: number[], manager: EntityManager): Promise<Map<number, unknown>> {
    if (accountIds.length === 0) {
      return new Map();
    }

    const rows = await manager.getRepository(InvestmentDetails).find({ where: { accountId: In(accountIds) } });

    return new Map(rows.map((row) => [row.accountId, row]));
  }

  /**
   * Inserts or updates the account's details row (always one, all `null`
   * when no `investment` object was sent).
   * @param {Account} account - The saved account.
   * @param {unknown} prepared - The {@link InvestmentState} returned by the validate step.
   * @param {EntityManager} manager - The transactional entity manager.
   * @returns {Promise<void>}
   */
  async saveDetails(account: Account, prepared: unknown, manager: EntityManager): Promise<void> {
    const state = investmentStateOf(prepared as InvestmentState | undefined);

    await manager.getRepository(InvestmentDetails).save({ ...state, accountId: account.id });
  }

  /**
   * @param {unknown} details - The loaded row, if any.
   * @returns {InvestmentResponse} The nested `investment` object.
   */
  serialize(details: unknown): InvestmentResponse {
    return serializeInvestmentState(investmentStateOf(details as InvestmentState | undefined));
  }

  #merge(base: InvestmentState, nested: unknown): InvestmentState {
    const merged = nested === undefined ? base : mergeInvestmentState(base, nested as InvestmentDetailsDto);
    assertInvestmentPairs(merged);

    return merged;
  }
}
