import type { EntityManager } from 'typeorm';
import type { Account } from '../entities/account.entity.js';

/**
 * Multi-provider token: the list of every registered
 * {@link AccountTypeHandler}. A later account type registers one more handler
 * by adding it to this provider's `inject` list in `BankModule`.
 */
export const ACCOUNT_TYPE_HANDLERS = 'BANK_ACCOUNT_TYPE_HANDLERS';

/**
 * The extension point of the generic account routes. Each account `type`
 * (`regular`, later `debt`, `investment`, `provider_expense`) registers one
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
   * Validates the type's nested object on create.
   * @param {unknown} nested - The nested body object (`undefined` when absent).
   * @returns {void}
   * @throws {BadRequestException} When the nested object is invalid.
   */
  validateCreate(nested: unknown): void;

  /**
   * Validates the type's nested object on update.
   * @param {unknown} nested - The nested body object (`undefined` when absent).
   * @returns {void}
   * @throws {BadRequestException} When the nested object is invalid.
   */
  validateUpdate(nested: unknown): void;

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
   * @param {unknown} nested - The validated nested body object, if any.
   * @param {EntityManager} manager - The (transactional) entity manager.
   * @returns {Promise<void>}
   */
  saveDetails(account: Account, nested: unknown, manager: EntityManager): Promise<void>;

  /**
   * Serializes the details into the nested response object.
   * @param {unknown} details - The details loaded by {@link loadDetails}, if any.
   * @returns {Record<string, unknown> | undefined} The nested object, or
   *   `undefined` when the type has none.
   */
  serialize(details: unknown): Record<string, unknown> | undefined;
}
