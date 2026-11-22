import ProviderBillsClient from '../../../../../../client/ProviderBillsClient.js';
import { classifyError } from '../../../common/bankErrors.js';
import { runLoad } from '../../../common/runLoad.js';
import { BILL_PAID_MESSAGE } from '../../../bills/pages/controllers/BillFormController.js';

/** Message shown when a recurring bill with payments is deleted (`409 PROVIDER_BILL_PAID`). */
export const RECURRING_PAID_MESSAGE = "This bill has payments and can't be deleted. Untick 'Show in calendar' to stop it.";

/** The page shown when the list answers Not-found. */
export const EMPTY_BILLS = {
  provider_bills: [], pagination: { page: 1, per_page: 0, total_pages: 0, total_count: 0 },
};

/**
 * Controller of the **Bills** block of a provider detail: loads a page and deletes a bill.
 *
 * @description `PROVIDER_BILL_PAID` is mapped to a message by kind (recurring vs one-off); any
 * other failure is classified with `classifyError` and shown with its server message (a
 * network / 5xx failure offers Retry). A session-expired failure shows nothing (the login modal
 * is already open) and only resets the pending / confirmation state.
 */
export default class ProviderBillsController {
  /**
   * Create the controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {number|string} options.providerId - The provider account id.
   * @param {Function} options.setData - Sets the loaded page.
   * @param {Function} options.setError - Sets the classified error.
   * @param {Function} options.setPending - Sets the delete in-flight flag.
   * @param {Function} options.setConfirmation - Opens / closes the Delete confirmation.
   * @param {Function} options.reload - Reloads the current page.
   * @param {typeof ProviderBillsClient} [options.client] - HTTP client override.
   */
  constructor({
    context, providerId, setData, setError, setPending, setConfirmation, reload,
    client = ProviderBillsClient,
  }) {
    this.context = context;
    this.providerId = providerId;
    this.setData = setData;
    this.setError = setError;
    this.setPending = setPending;
    this.setConfirmation = setConfirmation;
    this.reload = reload;
    this.client = client;
  }

  /**
   * Load one page of bills.
   *
   * @param {number} page - The 1-based page.
   * @param {Function} [isActive] - Liveness check; late answers are dropped once it is false.
   * @returns {Promise<void>} Resolves once the outcome is reported.
   */
  async load(page, isActive = () => true) {
    await runLoad(() => this.client.listProviderBills(this.context, this.providerId, page), {
      onLoaded: this.setData,
      onNotFound: () => this.setData(EMPTY_BILLS),
      onError: (error) => this.setError({ ...error, retry: this.reload }),
    }, isActive);
  }

  /**
   * Delete a bill, then reload.
   *
   * @param {object} bill - The bill to delete.
   * @returns {Promise<void>} Resolves once handled.
   */
  async delete(bill) {
    this.setError(null);
    this.setPending(true);

    try {
      await this.client.deleteProviderBill(this.context, bill.id);

      this.finish();
      this.reload();
    } catch (error) {
      this.handleError(error, bill);
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
   * Handle a failed delete (see the class description).
   *
   * @param {Error} error - The error thrown by the client.
   * @param {object} bill - The bill whose delete failed.
   * @returns {void} Nothing.
   */
  handleError(error, bill) {
    const classified = classifyError(error);

    this.finish();

    if (classified.kind === 'sessionExpired') {
      return;
    }

    if (classified.code === 'PROVIDER_BILL_PAID') {
      const message = bill.kind === 'recurring' ? RECURRING_PAID_MESSAGE : BILL_PAID_MESSAGE;

      this.setError({ ...classified, message, messages: [message] });
      return;
    }

    if (classified.kind === 'transient') {
      this.setError({ ...classified, retry: () => this.delete(bill) });
      return;
    }

    this.setError(classified.kind === 'notFound' ? { ...classified, kind: 'conflict' } : classified);
    this.reload();
  }
}
