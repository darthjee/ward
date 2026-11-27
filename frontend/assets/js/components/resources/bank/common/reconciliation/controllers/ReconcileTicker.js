import BankClient from '../../../../../../client/BankClient.js';
import { eligibleIds, isTicked } from './eligibility.js';
import { classifyReconciliationError } from './reconciliationErrors.js';

/**
 * Restore the previous overlay entries of some ids.
 *
 * @param {Map<number, boolean>} ticked - The current overlay.
 * @param {Map<number, (boolean|undefined)>} previous - The previous entry of each id
 *   (`undefined` when there was none).
 * @returns {Map<number, boolean>} The restored overlay.
 */
function restoreOverlay(ticked, previous) {
  const restored = new Map(ticked);

  previous.forEach((value, id) => {
    if (value === undefined) {
      restored.delete(id);
    } else {
      restored.set(id, value);
    }
  });

  return restored;
}

/**
 * Ticks and unticks of the open statement, optimistically.
 *
 * @description Base of {@link ReconcileController}: it holds the dependencies, reports failed
 * requests and runs the ticks. The overlay of the ids is flipped before
 * the request, the statement is replaced by the response (the live difference) and, on an
 * error, the checkboxes and the statement are restored.
 */
export default class ReconcileTicker {
  /**
   * Create the ticker.
   *
   * @param {object} options - Dependencies.
   * @param {object} options.context - The owner context.
   * @param {number|string} options.accountId - The account id.
   * @param {object} options.account - The loaded account.
   * @param {Function} options.setReconcile - Merges a patch into the reconcile state.
   * @param {typeof BankClient} [options.client] - HTTP client override.
   */
  constructor({
    context, accountId, account, setReconcile, client = BankClient,
  }) {
    this.context = context;
    this.accountId = accountId;
    this.account = account;
    this.setReconcile = setReconcile;
    this.client = client;
  }

  /**
   * Tick or untick one row, optimistically.
   *
   * @param {object} row - The ledger row.
   * @param {{statement: object, ticked: Map<number, boolean>}} state - The reconcile state.
   * @returns {Promise<void>} Resolves once handled.
   */
  async toggle(row, state) {
    await this.applyTicks([row.id], !isTicked(row, state), state);
  }

  /**
   * Tick every unticked eligible row of the page, in one call.
   *
   * @param {Array<object>} rows - The page's ledger rows.
   * @param {{statement: object, ticked: Map<number, boolean>}} state - The reconcile state.
   * @returns {Promise<void>} Resolves once handled.
   */
  async tickAll(rows, state) {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ids = eligibleIds(rows, { account: this.account, statement: state.statement })
      .filter((id) => !isTicked(byId.get(id), state));

    await this.applyTicks(ids, true, state);
  }

  /**
   * Untick every ticked eligible row of the page, in one call.
   *
   * @param {Array<object>} rows - The page's ledger rows.
   * @param {{statement: object, ticked: Map<number, boolean>}} state - The reconcile state.
   * @returns {Promise<void>} Resolves once handled.
   */
  async untickAll(rows, state) {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ids = eligibleIds(rows, { account: this.account, statement: state.statement })
      .filter((id) => isTicked(byId.get(id), state));

    await this.applyTicks(ids, false, state);
  }

  /**
   * Flip the overlay of the ids, send one ticks request, and take the new statement from the
   * response; on error the checkboxes and the statement are restored. An empty set sends
   * nothing.
   *
   * @param {Array<number>} ids - The transaction ids.
   * @param {boolean} tick - True to tick, false to untick.
   * @param {{statement: object, ticked: Map<number, boolean>}} state - The reconcile state.
   * @returns {Promise<void>} Resolves once handled.
   */
  async applyTicks(ids, tick, state) {
    if (ids.length === 0) {
      return;
    }

    const previous = new Map(ids.map((id) => [id, state.ticked.get(id)]));
    const body = tick ? { tick: ids } : { untick: ids };

    this.setReconcile((current) => ({
      error: null, ticked: new Map([...current.ticked, ...ids.map((id) => [id, tick])]),
    }));

    try {
      const statement = await this.client.tickTransactions(this.context, this.accountId, state.statement.id, body);

      this.setReconcile({ statement });
    } catch (error) {
      this.setReconcile((current) => ({
        statement: state.statement, ticked: restoreOverlay(current.ticked, previous),
      }));
      this.fail(error);
    }
  }

  /**
   * Report a failed request.
   *
   * @param {Error} error - The error thrown by the client.
   * @param {object} [extra] - Extra patch applied with the error.
   * @returns {void} Nothing.
   */
  fail(error, extra = {}) {
    const classified = classifyReconciliationError(error);

    if (classified.kind === 'sessionExpired') {
      this.setReconcile({ pending: false, ...extra });
      return;
    }

    const shown = classified.kind === 'notFound' ? { ...classified, kind: 'conflict' } : classified;

    this.setReconcile({ pending: false, error: shown, ...extra });
  }
}
