import BillsClient from '../../../../../../client/BillsClient.js';
import { classifyError } from '../../bankErrors.js';
import { runLoad } from '../../runLoad.js';

/** The history shown when the list answers Not-found. */
export const EMPTY_HISTORY = {
  payments: [], pagination: { page: 1, per_page: 0, total_pages: 0, total_count: 0 },
};

/**
 * Controller of an account's **Bill history** (debt / provider detail pages): loads a page and
 * undoes a row's payment.
 *
 * @description A derived row (`bill === null`) is undone through
 * `DELETE …/accounts/:accountId/occurrences/:dueDate/payment.json`, a one-off row through
 * `DELETE …/bills/:billId/payment.json`. While an undo runs the pending flag is set. On success
 * the list (and, through `onUndone`, the account) reloads. A network / 5xx failure shows the
 * alert with Retry; any other failure (`404` already undone, `409`) shows its message (a `404`
 * shown like a conflict, since the alert hides Not-found) and reloads.
 */
export default class BillHistoryController {
  /**
   * Create the controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {number|string} options.accountId - The debt / provider account id.
   * @param {Function} options.setData - Sets the loaded history page.
   * @param {Function} options.setError - Sets the classified error.
   * @param {Function} options.setPending - Sets the undo in-flight flag.
   * @param {Function} options.setConfirmation - Opens / closes the Undo confirmation.
   * @param {Function} options.reload - Reloads the current history page.
   * @param {Function} [options.onUndone] - Called after an undo attempt (reloads the account).
   * @param {typeof BillsClient} [options.client] - HTTP client override.
   */
  constructor({
    context, accountId, setData, setError, setPending, setConfirmation, reload,
    onUndone = () => undefined, client = BillsClient,
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
    await runLoad(() => this.client.listBillPayments(this.context, this.accountId, page), {
      onLoaded: this.setData,
      onNotFound: () => this.setData(EMPTY_HISTORY),
      onError: (error) => this.setError({ ...error, retry: this.reload }),
    }, isActive);
  }

  /**
   * Send the undo request matching the row (derived or one-off).
   *
   * @param {object} row - The history row.
   * @returns {Promise<object|undefined>} The (empty) response body.
   */
  sendUndo(row) {
    if (row.bill) {
      return this.client.undoBillPayment(this.context, row.bill.id);
    }

    return this.client.undoOccurrencePayment(this.context, this.accountId, row.due_date);
  }

  /**
   * Undo a row's payment (or skip), then reload.
   *
   * @param {object} row - The history row.
   * @returns {Promise<void>} Resolves once handled.
   */
  async undo(row) {
    this.setError(null);
    this.setPending(true);

    try {
      const reply = await this.sendUndo(row);

      this.finish();

      if (reply !== undefined) {
        this.refresh();
      }
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
    const classified = classifyError(error);

    this.finish();

    if (classified.kind === 'transient') {
      this.setError({ ...classified, retry });
      return;
    }

    // The alert hides a `notFound` (pages render NotFound instead); here the row was already
    // undone elsewhere, so its message is shown like a conflict.
    this.setError(classified.kind === 'notFound' ? { ...classified, kind: 'conflict' } : classified);
    this.refresh();
  }
}
