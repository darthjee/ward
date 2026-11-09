import type { EntityManager } from 'typeorm';
import type { Account } from '../entities/account.entity.js';

/**
 * Multi-provider token: the list of every registered
 * {@link AccountTypeHandler}. A later account type registers one more handler
 * by adding it to this provider's `inject` list in `BankModule`.
 */
export const ACCOUNT_TYPE_HANDLERS = 'BANK_ACCOUNT_TYPE_HANDLERS';

/**
 * What a handler needs to know about the account it validates a nested
 * object for.
 */
export interface AccountTypeContext {
  /** The account's currency once the request is applied. */
  currency: string;
  /** The stored currency before the request; stored amounts are rescaled when it differs. */
  previousCurrency?: string;
}

/**
 * The extension point of the generic account routes. Each account `type`
 * (`regular`, `debt`, `investment`, `provider_expense`) registers one
 * handler; the generic `AccountService` only ever talks to handlers through
 * the registry and never names a specific type. A type's nested body and
 * response object is named after the type (e.g. `debt`).
 */
export interface AccountTypeHandler {
  /** The account type served (the `type` column value and the nested object's key). */
  readonly type: string;
  /** Whether accounts of this type carry a ledger (transactions, balance). */
  readonly carriesLedger: boolean;

  /**
   * Checks the type's account-level rules on the account as it is about to
   * be saved (create and PATCH; e.g. an investment's `opening_balance` must
   * be 0).
   * @param {Account} account - The account with the request applied.
   * @returns {void}
   * @throws {BadRequestException} When an account-level rule is broken.
   */
  validateAccount(account: Account): void;

  /**
   * Validates the type's nested object on create.
   * @param {unknown} nested - The nested body object (`undefined` when absent).
   * @param {AccountTypeContext} context - The new account's currency.
   * @returns {unknown} The prepared details, handed to {@link saveDetails}.
   * @throws {BadRequestException} When the nested object is invalid.
   */
  validateCreate(nested: unknown, context: AccountTypeContext): unknown;

  /**
   * Validates the type's nested object on update, merged onto the stored
   * details (paired rules are checked on the merged result).
   * @param {unknown} nested - The nested body object (`undefined` when absent).
   * @param {unknown} stored - The stored details loaded by {@link loadDetails}, if any.
   * @param {AccountTypeContext} context - The account's (final and previous) currency.
   * @returns {unknown} The prepared details, handed to {@link saveDetails}.
   * @throws {BadRequestException} When the nested object or the merged result is invalid.
   */
  validateUpdate(nested: unknown, stored: unknown, context: AccountTypeContext): unknown;

  /**
   * Loads the one-to-one details rows of the given accounts.
   * @param {number[]} accountIds - The accounts (all of this type).
   * @param {EntityManager} manager - The entity manager to read through.
   * @returns {Promise<Map<number, unknown>>} Details keyed by account id.
   */
  loadDetails(accountIds: number[], manager: EntityManager): Promise<Map<number, unknown>>;

  /**
   * Creates or updates the account's details row.
   * @param {Account} account - The saved account.
   * @param {unknown} prepared - The details returned by the validate step.
   * @param {EntityManager} manager - The (transactional) entity manager.
   * @returns {Promise<void>}
   */
  saveDetails(account: Account, prepared: unknown, manager: EntityManager): Promise<void>;

  /**
   * Serializes the details into the nested response object.
   * @param {unknown} details - The details loaded by {@link loadDetails}, if any.
   * @param {Account} account - The account (e.g. for its currency).
   * @returns {Record<string, unknown> | undefined} The nested object, or
   *   `undefined` when the type has none.
   */
  serialize(details: unknown, account: Account): Record<string, unknown> | undefined;
}
