import { Injectable } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import type { AccountTypeContext, AccountTypeHandler } from './account-type-handler.js';
import { rescaleProviderBills } from './provider-bill-rescale.js';
import { syncBillDescription, syncProviderBill } from './provider-bill-write-through.js';
import type { WithPayingAccount } from './schedule-fields.js';
import { withPayingAccounts } from '../account-refs.js';
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
import { ProviderBill } from '../entities/provider-bill.entity.js';
import { ProviderExpenseDetails } from '../entities/provider-expense-details.entity.js';
import { todayUtc } from '../ledger-date.js';
import { lockProvider } from '../provider-bill-checks.js';
import { providerHasMultipleBills } from '../provider-bill-conflicts.js';

/** The nested fields that make a request a schedule edit (the write-through only runs for these). */
const SCHEDULE_KEYS = ['expected_amount', 'charge_frequency', 'due_day', 'due_month', 'bills_from', 'show_in_calendar', 'paying_account_id'] as const;

/** What the validate step learned that `saveDetails` needs, kept off the prepared state. */
interface SaveContext {
  scheduleSent: boolean;
  previousName?: string;
  previousCurrency?: string;
}

// Keyed by the prepared state object (always a fresh one per request), so the state stays plain.
const SAVE_CONTEXTS = new WeakMap<object, SaveContext>();

function scheduleSentIn(nested: unknown): boolean {
  const dto = nested as ProviderExpenseDetailsDto | undefined;

  return dto !== undefined && SCHEDULE_KEYS.some((key) => dto[key] !== undefined);
}

/**
 * Handler of `provider_expense` accounts (see
 * `docs/agents/modules/bank/provider-expense.md`): a provider's
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
    return this.#remember(this.#merge(defaultProviderExpenseState(), nested, context.currency), nested, context);
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

    return this.#remember(this.#merge(base, nested, context.currency), nested, context);
  }

  /**
   * Loads the details rows in one query, plus one for their default paying
   * accounts' names (no N+1).
   * @param {number[]} accountIds - The provider-expense accounts.
   * @param {EntityManager} manager - The entity manager.
   * @returns {Promise<Map<number, unknown>>} The rows keyed by account id.
   */
  async loadDetails(accountIds: number[], manager: EntityManager): Promise<Map<number, unknown>> {
    if (accountIds.length === 0) {
      return new Map();
    }

    const rows = await manager.getRepository(ProviderExpenseDetails).find({ where: { accountId: In(accountIds) } });

    return new Map((await withPayingAccounts(rows, manager)).map((row) => [row.accountId, row]));
  }

  /**
   * Inserts or updates the account's details row, then keeps its recurring
   * provider bills in step, all in the caller's transaction:
   *
   * - a schedule field with two or more recurring bills answers 409 before anything is written;
   * - a currency change rescales every bill (both kinds) and re-checks their paying accounts;
   * - the schedule write-through runs only when a schedule field was sent;
   * - the description follows the name only on a rename, with exactly one recurring bill.
   * @param {Account} account - The saved account.
   * @param {unknown} prepared - The {@link ProviderExpenseState} returned by the validate step.
   * @param {EntityManager} manager - The transactional entity manager.
   * @returns {Promise<void>}
   * @throws {ConflictException} `PROVIDER_HAS_MULTIPLE_BILLS`.
   */
  async saveDetails(account: Account, prepared: unknown, manager: EntityManager): Promise<void> {
    const state = providerExpenseStateOf(prepared as ProviderExpenseState | undefined);
    const context = SAVE_CONTEXTS.get(prepared as object) ?? { scheduleSent: false };
    const renamed = context.previousName !== undefined && context.previousName !== account.name;
    const previousCurrency = context.previousCurrency !== account.currency ? context.previousCurrency : undefined;
    const recurring = await this.#lockedRecurringBills(account, manager, context.scheduleSent || renamed || previousCurrency !== undefined);

    if (context.scheduleSent && recurring.length >= 2) {
      throw providerHasMultipleBills();
    }

    await manager.getRepository(ProviderExpenseDetails).save({ ...state, accountId: account.id });

    if (previousCurrency !== undefined) {
      await rescaleProviderBills(account, previousCurrency, manager);
    }

    await this.#syncBills(account, { state, recurring, scheduleSent: context.scheduleSent, renamed }, manager);
  }

  /**
   * @param {unknown} details - The loaded row, if any.
   * @param {Account} account - The account, for its currency.
   * @returns {ProviderExpenseResponse} The nested `provider_expense` object.
   */
  serialize(details: unknown, account: Account): ProviderExpenseResponse {
    const loaded = details as (ProviderExpenseState & WithPayingAccount) | undefined;

    return serializeProviderExpenseState(providerExpenseStateOf(loaded), account.currency, loaded?.payingAccount ?? null);
  }

  async #syncBills(
    account: Account,
    sync: { state: ProviderExpenseState; recurring: ProviderBill[]; scheduleSent: boolean; renamed: boolean },
    manager: EntityManager,
  ): Promise<void> {
    if (sync.scheduleSent) {
      await syncProviderBill(account, sync.state, sync.recurring[0], manager);
    } else if (sync.renamed && sync.recurring.length === 1) {
      await syncBillDescription(account, sync.recurring[0], manager);
    }
  }

  async #lockedRecurringBills(account: Account, manager: EntityManager, needed: boolean): Promise<ProviderBill[]> {
    if (!needed) {
      return [];
    }

    await lockProvider(manager, account.id);

    return manager.getRepository(ProviderBill).find({ where: { providerAccountId: account.id, kind: 'recurring' } });
  }

  #remember(prepared: ProviderExpenseState, nested: unknown, context: AccountTypeContext): ProviderExpenseState {
    SAVE_CONTEXTS.set(prepared, {
      scheduleSent: scheduleSentIn(nested),
      previousName: context.previousName,
      previousCurrency: context.previousCurrency,
    });

    return prepared;
  }

  #merge(base: ProviderExpenseState, nested: unknown, currency: string): ProviderExpenseState {
    const merged = nested === undefined ? base : mergeProviderExpenseState(base, nested as ProviderExpenseDetailsDto, currency, todayUtc(new Date()));
    assertProviderExpensePairs(merged);

    return merged;
  }
}
