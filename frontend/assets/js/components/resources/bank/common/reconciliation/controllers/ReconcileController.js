import { localToday } from '../../dates.js';
import ReconcileTicker from './ReconcileTicker.js';
import { statementFieldsFor, validateStatementFields } from './statementFields.js';

/** The reconcile state while the mode is off. */
export const INITIAL_RECONCILE = Object.freeze({
  mode: 'off',
  statement: null,
  formKind: 'start',
  fields: {},
  fieldErrors: {},
  ticked: new Map(),
  onlyUncleared: false,
  pending: false,
  error: null,
  cancelConfirm: false,
  historyVersion: 0,
});

/**
 * The patch leaving reconcile mode (after finish or cancel): the overlay is cleared and the
 * history version bumped so the history reloads.
 *
 * @param {{historyVersion: number}} previous - The previous reconcile state.
 * @returns {object} The patch.
 */
function leaveMode(previous) {
  return {
    ...INITIAL_RECONCILE, ticked: new Map(), historyVersion: previous.historyVersion + 1,
  };
}

/**
 * Controller of the **reconcile mode** of an account detail page.
 *
 * @description Every method reports through `setReconcile(patch)`, where `patch` is an object
 * (or a function of the previous state returning one) merged into the reconcile state. The
 * current state is handed in by the handlers, so the controller keeps none. Every error goes
 * through {@link classifyReconciliationError}; a session-expired error shows nothing (the login
 * modal is already open) and a Not-found is shown like a conflict, since the alert hides it.
 */
export default class ReconcileController extends ReconcileTicker {
  /**
   * Create the controller.
   *
   * @param {object} options - Controller dependencies (see {@link ReconcileTicker}).
   * @param {object} options.context - The owner context.
   * @param {number|string} options.accountId - The account id.
   * @param {object} options.account - The loaded account (`opening_date`, `currency`, `type`,
   *   `open_reconciliation_id`).
   * @param {Function} options.setReconcile - Merges a patch into the reconcile state.
   * @param {Function} options.reload - Reloads the account and the ledger page.
   * @param {typeof BankClient} [options.client] - HTTP client override.
   */
  constructor({ reload, ...options }) {
    super(options);
    this.reload = reload;
  }

  /**
   * Enter reconcile mode: the start form, or the open statement.
   *
   * @returns {Promise<void>} Resolves once handled.
   */
  async open() {
    const openId = this.account.open_reconciliation_id;

    if (openId === null || openId === undefined) {
      this.showForm('start', null);
      return;
    }

    this.setReconcile({ pending: true, error: null });

    try {
      const statement = await this.client.getReconciliation(this.context, this.accountId, openId);

      this.setReconcile({
        mode: 'active', statement, pending: false, ticked: new Map(),
      });
    } catch (error) {
      this.fail(error);
    }
  }

  /**
   * Show the statement form.
   *
   * @param {string} formKind - `'start'` or `'edit'`.
   * @param {object|null} statement - The statement to prefill (edit), or `null` (start).
   * @returns {void} Nothing.
   */
  showForm(formKind, statement) {
    this.setReconcile({
      mode: 'form',
      formKind,
      fields: statementFieldsFor({ statement, account: this.account, today: localToday() }),
      fieldErrors: {},
      error: null,
    });
  }

  /**
   * Open the edit form of the open statement.
   *
   * @param {object} statement - The open statement.
   * @returns {void} Nothing.
   */
  openEdit(statement) {
    this.showForm('edit', statement);
  }

  /**
   * Close the form without sending anything: back to the statement, or out of the mode.
   *
   * @param {object|null} statement - The open statement (edit), or `null` (start).
   * @returns {void} Nothing.
   */
  closeForm(statement) {
    this.setReconcile({
      mode: statement ? 'active' : 'off', fieldErrors: {}, error: null,
    });
  }

  /**
   * Change one form field.
   *
   * @param {string} name - The field name.
   * @param {string} value - The new value.
   * @returns {void} Nothing.
   */
  changeField(name, value) {
    this.setReconcile((previous) => ({ fields: { ...previous.fields, [name]: value } }));
  }

  /**
   * Validate and send the statement form (start or edit).
   *
   * @param {{formKind: string, fields: object, statement: (object|null)}} state - The reconcile
   *   state.
   * @returns {Promise<void>} Resolves once handled.
   */
  async submitForm(state) {
    const result = validateStatementFields(state.fields, this.account);

    if (result.fieldErrors) {
      this.setReconcile({ fieldErrors: result.fieldErrors });
      return;
    }

    this.setReconcile({ pending: true, error: null, fieldErrors: {} });

    try {
      const statement = await this.sendForm(state, result.body);

      this.setReconcile({ mode: 'active', statement, pending: false });

      if (state.formKind === 'start') {
        this.setReconcile({ ticked: new Map() });
        this.reload();
      }
    } catch (error) {
      this.fail(error);
    }
  }

  /**
   * Send the start or edit request.
   *
   * @param {{formKind: string, statement: (object|null)}} state - The reconcile state.
   * @param {object} body - The validated body.
   * @returns {Promise<object>} The statement.
   */
  sendForm(state, body) {
    if (state.formKind === 'edit') {
      return this.client.updateReconciliation(this.context, this.accountId, state.statement.id, body);
    }

    return this.client.startReconciliation(this.context, this.accountId, body);
  }

  /**
   * Toggle the local "Show only uncleared" filter (no request).
   *
   * @returns {void} Nothing.
   */
  toggleOnlyUncleared() {
    this.setReconcile((previous) => ({ onlyUncleared: !previous.onlyUncleared }));
  }

  /**
   * Finish the statement, leave the mode and reload.
   *
   * @param {{id: number}} statement - The open statement.
   * @returns {Promise<void>} Resolves once handled.
   */
  async finish(statement) {
    this.setReconcile({ pending: true, error: null });

    try {
      await this.client.finishReconciliation(this.context, this.accountId, statement.id);

      this.setReconcile(leaveMode);
      this.reload();
    } catch (error) {
      this.fail(error);
    }
  }

  /**
   * Ask to cancel the statement (opens the confirmation).
   *
   * @returns {void} Nothing.
   */
  requestCancel() {
    this.setReconcile({ cancelConfirm: true });
  }

  /**
   * Dismiss the cancel confirmation, sending nothing.
   *
   * @returns {void} Nothing.
   */
  dismissCancel() {
    this.setReconcile({ cancelConfirm: false });
  }

  /**
   * Cancel (delete) the statement, leave the mode and reload.
   *
   * @param {{id: number}} statement - The open statement.
   * @returns {Promise<void>} Resolves once handled.
   */
  async confirmCancel(statement) {
    this.setReconcile({ pending: true, error: null });

    try {
      await this.client.cancelReconciliation(this.context, this.accountId, statement.id);

      this.setReconcile(leaveMode);
      this.reload();
    } catch (error) {
      this.fail(error, { cancelConfirm: false });
    }
  }

  /**
   * Dismiss the alert.
   *
   * @returns {void} Nothing.
   */
  dismissError() {
    this.setReconcile({ error: null });
  }

  /**
   * The ledger reloaded: its rows carry the server's ticks, so the overlay is dropped.
   *
   * @returns {void} Nothing.
   */
  onLedgerReloaded() {
    this.setReconcile({ ticked: new Map() });
  }
}
