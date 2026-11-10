import AccountantClient from '../../../../../../client/AccountantClient.js';
import Download from '../../../common/download.js';
import { classifyError } from '../../../common/bankErrors.js';
import { lastFullMonth } from '../../../common/dates.js';
import { runLoad } from '../../../common/runLoad.js';
import { accountantCsvFilename, buildAccountantCsv } from '../../common/accountantCsv.js';
import { chargeCount } from '../../common/chargeTotals.js';

/**
 * Build the initial hand-off state: the last full month, unsent charges only, nothing loaded
 * yet (the preview loads on open).
 *
 * @param {Date} [now] - The current instant (injectable for specs).
 * @returns {object} The page state (`from`, `to`, `unsentOnly`, `charges`, `loadedRange`,
 *   `loading`, `error`, `notFound`, `confirming`, `marking`, `success`).
 */
export function initialHandoff(now = new Date()) {
  return {
    ...lastFullMonth(now),
    unsentOnly: true,
    charges: null,
    loadedRange: null,
    loading: true,
    error: null,
    notFound: false,
    confirming: false,
    marking: false,
    success: null,
  };
}

/**
 * Check the range on the client, mirroring the API: both dates required, `from` ≤ `to`.
 *
 * @param {{from: string, to: string}} range - The `YYYY-MM-DD` range.
 * @returns {string|null} The validation message, or `null` when the range may be sent.
 */
export function rangeError({ from, to }) {
  if (!from || !to) {
    return 'Choose both dates.';
  }

  return from > to ? 'The start date must not be after the end date.' : null;
}

/**
 * Attach a retry to a transient error (network / 5xx); other errors are shown as they are.
 *
 * @param {object} classified - The classified error.
 * @param {Function} retry - Re-runs the failed action.
 * @returns {object} The error for the page alert.
 */
function withRetry(classified, retry) {
  return classified.kind === 'transient' ? { ...classified, retry } : classified;
}

/**
 * Build the page alert of a failed Mark as sent: a transient failure offers Retry; a `404`
 * (a charge vanished meanwhile) is shown with its message rather than as Not-found.
 *
 * @param {object} classified - The classified error.
 * @param {Function} retry - Re-sends the marks.
 * @returns {object} The error for the page alert.
 */
function markError(classified, retry) {
  if (classified.kind === 'notFound') {
    return { ...classified, kind: 'conflict' };
  }

  return withRetry(classified, retry);
}

/**
 * Controller of the accountant hand-off page (`<ui>/bank/providers/accountant`).
 *
 * @description Loads the preview of the range (skipped, with nothing loaded, while the range
 * check fails); Download CSV and Mark as sent act on the loaded rows only. Mark as sent posts
 * exactly the loaded ids, then reloads the preview and shows "N charges marked as sent". API
 * `400`s (future date, > 366 days, > 1000 rows) and other failures go to the page alert; a
 * `404` (non-member organization) shows Not-found.
 */
export default class AccountantHandoffController {
  /**
   * Create the controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {Function} options.update - Merges a patch into the page state.
   * @param {Function} options.reload - Reloads the preview.
   * @param {typeof AccountantClient} [options.client] - HTTP client override.
   * @param {{text: Function}} [options.download] - Download module override.
   */
  constructor({
    context, update, reload, client = AccountantClient, download = Download,
  }) {
    this.context = context;
    this.update = update;
    this.reload = reload;
    this.client = client;
    this.download = download;
  }

  /**
   * Load the preview of a range, once the client-side range check passes.
   *
   * @param {{from: string, to: string, unsentOnly: boolean}} query - The range and the toggle.
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async load({ from, to, unsentOnly }, isActive = () => true) {
    if (rangeError({ from, to })) {
      this.update({ charges: null, loadedRange: null, loading: false });
      return;
    }

    this.update({ loading: true, error: null });

    await runLoad(() => this.request({ from, to, unsentOnly }), {
      onLoaded: (reply) => this.update({ charges: reply.charges ?? [], loadedRange: { from, to }, loading: false }),
      onNotFound: () => this.update({ loading: false, notFound: true }),
      onError: (error) => this.update({
        loading: false, charges: null, loadedRange: null, error: withRetry(error, this.reload),
      }),
    }, isActive);
  }

  /**
   * Fetch the preview; a session-expired `undefined` ends the loading state.
   *
   * @param {{from: string, to: string, unsentOnly: boolean}} query - The range and the toggle.
   * @returns {Promise<object|undefined>} The `{ charges }` reply.
   */
  async request({ from, to, unsentOnly }) {
    const reply = await this.client.listCharges(this.context, { from, to, includeSent: !unsentOnly });

    if (reply === undefined) {
      this.update({ loading: false });
    }

    return reply;
  }

  /**
   * Download the loaded rows as the hand-off CSV (an empty preview gives the header only).
   *
   * @param {{charges: (Array<object>|null), loadedRange: (object|null)}} state - Page state.
   * @returns {void} Nothing.
   */
  downloadCsv({ charges, loadedRange }) {
    if (!charges || !loadedRange) {
      return;
    }

    this.download.text(
      accountantCsvFilename(loadedRange.from, loadedRange.to),
      buildAccountantCsv(charges),
      { mimeType: 'text/csv;charset=utf-8' },
    );
  }

  /**
   * Mark exactly the loaded charges as sent, then reload the preview.
   *
   * @param {{charges: (Array<object>|null)}} state - Page state.
   * @returns {Promise<void>} Resolves once handled.
   */
  async markSent({ charges }) {
    const ids = (charges ?? []).map((charge) => charge.id);

    if (ids.length === 0) {
      this.update({ confirming: false });
      return;
    }

    this.update({ marking: true, error: null, success: null });

    try {
      const reply = await this.client.markSent(this.context, ids);

      this.update({ marking: false, confirming: false });

      if (reply !== undefined) {
        this.update({ success: `${chargeCount(ids.length)} marked as sent` });
        this.reload();
      }
    } catch (error) {
      this.update({
        marking: false, confirming: false, error: markError(classifyError(error), () => this.markSent({ charges })),
      });
    }
  }
}
