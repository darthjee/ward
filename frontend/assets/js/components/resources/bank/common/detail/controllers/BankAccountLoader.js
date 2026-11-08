import BankClient from '../../../../../../client/BankClient.js';
import { buildLoadEffect, runLoad } from '../../runLoad.js';

/**
 * Loads one account with a page of its ledger (detail and edit pages), and the bank settings
 * (create page).
 *
 * @description The ledger's `pagination.total_count` (real transactions only) is the "has
 * transactions" signal: it decides whether Delete is shown and whether the currency is locked.
 * Outcomes follow `runLoad`: `404` → Not-found, failures → the classified error, an expired
 * session → nothing, late answers dropped.
 */
export default class BankAccountLoader {
  #client;

  /**
   * Create a loader.
   *
   * @param {typeof BankClient} [client] - HTTP client override, for testability.
   */
  constructor(client = BankClient) {
    this.#client = client;
  }

  /**
   * Fetch the account and one ledger page, and report both together.
   *
   * @param {object} context - The owner context.
   * @param {number|string} accountId - The account id.
   * @param {number} page - The ledger page.
   * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
   *   callbacks (`onLoaded` receives `{ account, ledger }`).
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async load(context, accountId, page, callbacks, isActive = () => true) {
    await runLoad(async () => {
      const [account, ledger] = await Promise.all([
        this.#client.getAccount(context, accountId),
        this.#client.listTransactions(context, accountId, page),
      ]);

      return account && ledger ? { account, ledger } : undefined;
    }, callbacks, isActive);
  }

  /**
   * Fetch the bank settings (the default currency).
   *
   * @param {object} context - The owner context.
   * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
   *   callbacks (`onLoaded` receives the settings).
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async loadSettings(context, callbacks, isActive = () => true) {
    await runLoad(() => this.#client.getSettings(context), callbacks, isActive);
  }
}

/**
 * Build the load effect of an account page (account + ledger page). Exported so specs can run
 * it without a React renderer.
 *
 * @param {BankAccountLoader} loader - The loader.
 * @param {object} context - The owner context.
 * @param {number|string} accountId - The account id.
 * @param {number} page - The ledger page.
 * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
 *   callbacks.
 * @returns {Function} Effect callback, returning a cleanup that drops late answers.
 */
export function buildBankAccountLoadEffect(loader, context, accountId, page, callbacks) {
  return buildLoadEffect((isActive) => loader.load(context, accountId, page, callbacks, isActive));
}

/**
 * Build the settings load effect of the create page. Exported so specs can run it without a
 * React renderer.
 *
 * @param {BankAccountLoader} loader - The loader.
 * @param {object} context - The owner context.
 * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
 *   callbacks.
 * @returns {Function} Effect callback, returning a cleanup that drops late answers.
 */
export function buildBankSettingsLoadEffect(loader, context, callbacks) {
  return buildLoadEffect((isActive) => loader.loadSettings(context, callbacks, isActive));
}
