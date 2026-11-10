import AccountantClient from '../../../../../../client/AccountantClient.js';
import { classifyError } from '../../../common/bankErrors.js';

/**
 * Controller of a ledger charge's **Mark as unsent** link (the undo of Mark as sent).
 *
 * @description Posts the single id to `mark-unsent.json` without confirmation, then reloads
 * the account and its ledger. While it runs the pending flag is set (the link is disabled). A
 * network / 5xx failure shows the page alert with Retry; a `400` / `404` shows its message and
 * reloads.
 */
export default class MarkUnsentController {
  /**
   * Create the controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {Function} options.setPending - Sets the in-flight flag.
   * @param {Function} options.setError - Sets the page alert's classified error.
   * @param {Function} options.reload - Reloads the account and the current ledger page.
   * @param {typeof AccountantClient} [options.client] - HTTP client override.
   */
  constructor({
    context, setPending, setError, reload, client = AccountantClient,
  }) {
    this.context = context;
    this.setPending = setPending;
    this.setError = setError;
    this.reload = reload;
    this.client = client;
  }

  /**
   * Clear the sent mark of one charge, then reload.
   *
   * @param {{id: number}} transaction - The ledger charge.
   * @returns {Promise<void>} Resolves once handled.
   */
  async markUnsent(transaction) {
    this.setError(null);
    this.setPending(true);

    try {
      const reply = await this.client.markUnsent(this.context, [transaction.id]);

      this.setPending(false);

      if (reply !== undefined) {
        this.reload();
      }
    } catch (error) {
      this.handleError(error, () => this.markUnsent(transaction));
    }
  }

  /**
   * Handle a failed request (see the class description).
   *
   * @param {Error} error - The error thrown by the client.
   * @param {Function} retry - Re-sends the request.
   * @returns {void} Nothing.
   */
  handleError(error, retry) {
    const classified = classifyError(error);

    this.setPending(false);

    if (classified.kind === 'transient') {
      this.setError({ ...classified, retry });
      return;
    }

    this.setError(classified);
    this.reload();
  }
}
