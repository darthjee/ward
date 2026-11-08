import BankClient from '../../../../../../client/BankClient.js';
import { buildLoadEffect, runLoad } from '../../runLoad.js';

/**
 * Loads the accounts of one type for a list page (regular for Accounts, debt for Debts).
 *
 * @description A `404` (non-member organization) reports Not-found; any other failure reports
 * the classified error. An `undefined` result (session expired) reports nothing. Answers
 * arriving after `isActive()` turned false are ignored.
 */
export default class BankAccountsLoader {
  #client;

  #type;

  /**
   * Create a loader.
   *
   * @param {typeof BankClient} [client] - HTTP client override, for testability.
   * @param {{type: string}} [options] - The account type listed (default `'regular'`).
   */
  constructor(client = BankClient, { type = 'regular' } = {}) {
    this.#client = client;
    this.#type = type;
  }

  /**
   * Fetch the accounts and report the outcome.
   *
   * @param {object} context - The owner context.
   * @param {boolean} archived - Whether archived accounts are included.
   * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
   *   callbacks (`onError` receives the classified error).
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async load(context, archived, callbacks, isActive = () => true) {
    await runLoad(() => this.#client.listAccounts(context, { archived, type: this.#type }), callbacks, isActive);
  }
}

/**
 * Build the load-on-visit effect of an accounts list. Exported so specs can run it without a
 * React renderer.
 *
 * @param {BankAccountsLoader} loader - The loader.
 * @param {object} context - The owner context.
 * @param {boolean} archived - Whether archived accounts are included.
 * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
 *   callbacks.
 * @returns {Function} Effect callback, returning a cleanup that drops late answers.
 */
export function buildBankAccountsLoadEffect(loader, context, archived, callbacks) {
  return buildLoadEffect((isActive) => loader.load(context, archived, callbacks, isActive));
}
