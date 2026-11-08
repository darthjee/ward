import BankClient from '../../../../../../client/BankClient.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { classifyError } from '../../../common/bankErrors.js';
import { navigate } from '../../../common/currentHash.js';

/**
 * Controller for the account detail page's actions: archive, unarchive, delete the account and
 * delete a transaction.
 *
 * @description Each action sets its `pending` key while in flight (its button / the modal's
 * confirm is disabled, so a double click never sends twice). Write responses carry a masked
 * account number, so they are never displayed: the page reloads instead (delete → the list).
 * Errors: an account `404` → Not-found; a `409` → the message in the alert, then a reload
 * (`ACCOUNT_ARCHIVED` hides the writes, `ACCOUNT_HAS_TRANSACTIONS` hides Delete); network / 5xx
 * → the alert with Retry.
 */
export default class BankAccountDetailController {
  /**
   * Create a detail controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {number|string} options.accountId - The account id.
   * @param {Function} options.setPending - Sets the in-flight action key (`null` when idle).
   * @param {Function} options.setError - Sets the page alert's classified error.
   * @param {Function} options.setConfirm - Sets the open confirmation (`null` closes it).
   * @param {Function} options.reload - Reloads the account and the current ledger page.
   * @param {Function} options.onNotFound - Called on an account `404`.
   * @param {Function} [options.navigate] - Navigation override, for testability.
   * @param {typeof BankClient} [options.client] - HTTP client override.
   */
  constructor({
    context, accountId, setPending, setError, setConfirm, reload, onNotFound,
    navigate: navigateTo = navigate, client = BankClient,
  }) {
    this.context = context;
    this.accountId = accountId;
    this.setPending = setPending;
    this.setError = setError;
    this.setConfirm = setConfirm;
    this.reload = reload;
    this.onNotFound = onNotFound;
    this.navigate = navigateTo;
    this.client = client;
  }

  /**
   * Archive the account, then reload it.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  archive() {
    return this.run('archive', () => this.client.archiveAccount(this.context, this.accountId));
  }

  /**
   * Unarchive the account, then reload it.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  unarchive() {
    return this.run('unarchive', () => this.client.unarchiveAccount(this.context, this.accountId));
  }

  /**
   * Delete the account (only offered without transactions), then go to the list.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  deleteAccount() {
    return this.run(
      'delete',
      () => this.client.deleteAccount(this.context, this.accountId),
      () => this.navigate(contextHash(this.context, '/bank/accounts')),
    );
  }

  /**
   * Delete a transaction, then reload the current page.
   *
   * @param {object} transaction - The ledger row.
   * @returns {Promise<void>} Resolves once handled.
   */
  deleteTransaction(transaction) {
    return this.run(
      'delete',
      () => this.client.deleteTransaction(this.context, this.accountId, transaction.id),
      undefined,
      { transaction: true },
    );
  }

  /**
   * Run an action.
   *
   * @param {string} key - The pending key.
   * @param {Function} request - Sends the request.
   * @param {Function} [onDone] - Called on success (default: reload).
   * @param {{transaction: boolean}} [options] - `transaction`: a `404` concerns a transaction,
   *   not the account (reload instead of Not-found).
   * @returns {Promise<void>} Resolves once handled.
   */
  async run(key, request, onDone = () => this.reload(), options = {}) {
    this.setPending(key);
    this.setError(null);

    try {
      const result = await request();

      this.finish();

      if (result !== undefined) {
        onDone();
      }
    } catch (error) {
      this.finish();
      this.handleError(error, () => this.run(key, request, onDone, options), options);
    }
  }

  /**
   * Clear the in-flight key and close the confirmation.
   *
   * @returns {void} Nothing.
   */
  finish() {
    this.setPending(null);
    this.setConfirm(null);
  }

  /**
   * Handle a failed action (see the class description).
   *
   * @param {Error} error - The error thrown by the client.
   * @param {Function} retry - Re-runs the action.
   * @param {{transaction: boolean}} options - Whether the action concerned a transaction.
   * @returns {void} Nothing.
   */
  handleError(error, retry, { transaction = false }) {
    const classified = classifyError(error);

    if (classified.kind === 'notFound' && !transaction) {
      this.onNotFound();
      return;
    }

    if (classified.kind === 'transient') {
      this.setError({ ...classified, retry });
      return;
    }

    this.setError(classified);
    this.reload();
  }
}
