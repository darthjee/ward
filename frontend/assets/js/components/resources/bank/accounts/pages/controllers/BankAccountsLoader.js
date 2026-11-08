import BankClient from '../../../../../../client/BankClient.js';
import { classifyError } from '../../../common/bankErrors.js';

/**
 * Loads the regular accounts for the Accounts list page.
 *
 * @description A `404` (non-member organization) reports Not-found; any other failure reports
 * the classified error. An `undefined` result (session expired) reports nothing. Answers
 * arriving after `isActive()` turned false are ignored.
 */
export default class BankAccountsLoader {
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
   * Fetch the accounts and report the outcome.
   *
   * @param {object} context - The owner context.
   * @param {boolean} archived - Whether archived accounts are included.
   * @param {{onLoaded: Function, onNotFound: Function, onError: Function}} callbacks - Outcome
   *   callbacks (`onError` receives the classified error).
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async load(context, archived, { onLoaded, onNotFound, onError }, isActive = () => true) {
    try {
      const accounts = await this.#client.listAccounts(context, { archived });

      if (accounts && isActive()) {
        onLoaded(accounts);
      }
    } catch (error) {
      if (!isActive()) {
        return;
      }

      const classified = classifyError(error);

      if (classified.kind === 'notFound') {
        onNotFound();
        return;
      }

      onError(classified);
    }
  }
}

/**
 * Build the load-on-visit effect of the Accounts list. Exported so specs can run it without a
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
  return () => {
    let active = true;

    loader.load(context, archived, callbacks, () => active);

    return () => {
      active = false;
    };
  };
}
