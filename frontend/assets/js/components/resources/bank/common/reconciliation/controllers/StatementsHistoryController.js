import BankClient from '../../../../../../client/BankClient.js';
import { runLoad } from '../../runLoad.js';
import { classifyReconciliationError } from './reconciliationErrors.js';

/** The history shown when the list answers Not-found. */
export const EMPTY_HISTORY = {
  reconciliations: [], pagination: { page: 1, per_page: 0, total_pages: 0, total_count: 0 },
};

/**
 * Controller of an account's **Statements history**: loads a page and undoes the latest
 * finished statement.
 *
 * @description While an undo runs the pending flag is set. On success the list (and, through
 * `onUndone`, the account and ledger) reloads. A network / 5xx failure shows the alert with
 * Retry; any other failure (`404`, `409` such as `RECONCILIATION_NOT_LATEST` or
 * `RECONCILIATION_OPEN`) shows its message (a `404` shown like a conflict, since the alert
 * hides it) and reloads.
 */
export default class StatementsHistoryController {
  /**
   * Create the controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {number|string} options.accountId - The account id.
   * @param {Function} options.setData - Sets the loaded history page.
   * @param {Function} options.setError - Sets the classified error.
   * @param {Function} options.setPending - Sets the undo in-flight flag.
   * @param {Function} options.setConfirmation - Opens / closes the Undo confirmation.
   * @param {Function} options.reload - Reloads the current history page.
   * @param {Function} [options.onUndone] - Called after an undo attempt (reloads the account).
   * @param {typeof BankClient} [options.client] - HTTP client override.
   */
  constructor({
    context, accountId, setData, setError, setPending, setConfirmation, reload,
    onUndone = () => undefined, client = BankClient,
  }) {
    this.context = context;
    this.accountId = accountId;
    this.setData = setData;
    this.setError = setError;
    this.setPending = setPending;
    this.setConfirmation = setConfirmation;
    this.reload = reload;
    this.onUndone = onUndone;
    this.client = client;
  }

  /**
   * Load one page of the history.
   *
   * @param {number} page - The 1-based page.
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async load(page, isActive = () => true) {
    await runLoad(() => this.client.listReconciliations(this.context, this.accountId, page), {
      onLoaded: this.setData,
      onNotFound: () => this.setData(EMPTY_HISTORY),
      onError: (error) => this.setError({ ...error, retry: this.reload }),
    }, isActive);
  }

  /**
   * Undo a statement, then reload.
   *
   * @param {{id: number}} row - The history row.
   * @returns {Promise<void>} Resolves once handled.
   */
  async undo(row) {
    this.setError(null);
    this.setPending(true);

    try {
      await this.client.undoReconciliation(this.context, this.accountId, row.id);

      this.finish();
      this.refresh();
    } catch (error) {
      this.handleError(error, () => this.undo(row));
    }
  }

  /**
   * Clear the in-flight flag and close the confirmation.
   *
   * @returns {void} Nothing.
   */
  finish() {
    this.setPending(false);
    this.setConfirmation(null);
  }

  /**
   * Reload the history and the account.
   *
   * @returns {void} Nothing.
   */
  refresh() {
    this.reload();
    this.onUndone();
  }

  /**
   * Handle a failed undo (see the class description).
   *
   * @param {Error} error - The error thrown by the client.
   * @param {Function} retry - Re-sends the request.
   * @returns {void} Nothing.
   */
  handleError(error, retry) {
    const classified = classifyReconciliationError(error);

    this.finish();

    if (classified.kind === 'sessionExpired') {
      return;
    }

    if (classified.kind === 'transient') {
      this.setError({ ...classified, retry });
      return;
    }

    this.setError(classified.kind === 'notFound' ? { ...classified, kind: 'conflict' } : classified);
    this.refresh();
  }
}
