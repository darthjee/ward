import BankClient from '../../../../../../client/BankClient.js';
import { classifyError } from '../../../common/bankErrors.js';
import { validateLedgerValues } from './ledgerFormFields.js';

/**
 * Controller for the ledger's inline form row (create and edit a transaction).
 *
 * @description Validates on the client and sets `pending` while the request runs (Save is
 * disabled, so a double click never sends twice). After a **create** the ledger goes to page 1
 * (where the newest rows are) — or reloads when already there; after an **edit** it reloads the
 * current page (running balances change). Errors: `400` → shown on the row, values kept; `409`
 * and `404` → the message in the page alert, then a reload (an account `404` then shows
 * Not-found); network / 5xx → the page alert with Retry.
 */
export default class LedgerFormController {
  /**
   * Create a ledger form controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {number|string} options.accountId - The account id.
   * @param {Function} options.update - Merges a patch into the form state.
   * @param {Function} options.reset - Resets the form to a new, empty transaction.
   * @param {Function} options.setError - Sets the page alert's classified error.
   * @param {Function} options.reload - Reloads the account and the current ledger page.
   * @param {Function} options.goToFirstPage - Navigates to ledger page 1.
   * @param {typeof BankClient} [options.client] - HTTP client override.
   */
  constructor({
    context, accountId, update, reset, setError, reload, goToFirstPage, client = BankClient,
  }) {
    this.context = context;
    this.accountId = accountId;
    this.update = update;
    this.reset = reset;
    this.setError = setError;
    this.reload = reload;
    this.goToFirstPage = goToFirstPage;
    this.client = client;
  }

  /**
   * Send the create or update request.
   *
   * @param {object|null} editing - The transaction being edited, or `null` to create.
   * @param {object} body - The validated body.
   * @returns {Promise<object|undefined>} The saved transaction.
   */
  request(editing, body) {
    if (editing) {
      return this.client.updateTransaction(this.context, this.accountId, editing.id, body);
    }

    return this.client.createTransaction(this.context, this.accountId, body);
  }

  /**
   * Validate and save the form.
   *
   * @param {{editing: (object|null), values: object}} form - The form state.
   * @param {{currency: string, page: number}} options - The account currency and the current
   *   ledger page.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async submit(form, { currency, page }) {
    const { editing, values } = form;
    const { errors, body } = validateLedgerValues(values, { currency, editing: Boolean(editing) });

    this.update({ fieldErrors: errors, error: null });

    if (!body) {
      return;
    }

    this.setError(null);
    this.update({ pending: true });

    try {
      const saved = await this.request(editing, body);

      if (!saved) {
        this.update({ pending: false });
        return;
      }

      this.reset();
      this.afterSave(editing, page);
    } catch (error) {
      this.handleError(error, () => this.submit(form, { currency, page }));
    }
  }

  /**
   * Refresh the ledger after a save: page 1 after a create, the current page after an edit.
   *
   * @param {object|null} editing - The edited transaction, or `null` after a create.
   * @param {number} page - The current ledger page.
   * @returns {void} Nothing.
   */
  afterSave(editing, page) {
    if (editing || page === 1) {
      this.reload();
      return;
    }

    this.goToFirstPage();
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

    this.update({ pending: false });

    if (classified.kind === 'validation') {
      this.update({ error: classified });
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
