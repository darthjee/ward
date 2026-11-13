import BillsClient from '../../../../../../client/BillsClient.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { classifyError } from '../../../common/bankErrors.js';
import { navigate } from '../../../common/currentHash.js';
import { PROVIDERS_BASE } from '../../../common/sections.js';
import { billFieldsFromBill, changedBillFields, validateBillFields } from './billFormFields.js';

/** Message shown when a paid bill is changed or deleted (`409 BILL_PAID`). */
export const BILL_PAID_MESSAGE = 'This bill is paid: undo the payment first.';

/**
 * Submit, update and delete flow of the one-off bill pages (`<ui>/bills/new`,
 * `<ui>/bills/:id/edit`).
 *
 * @description Validates on the client, sets `pending` while a request runs (so a double click
 * never sends twice), then goes to the bill's provider detail page. An edit sends only the
 * changed fields (nothing changed → straight back). Errors are classified: `404` → Not-found;
 * `409 BILL_PAID` → the form alert telling the user to undo the payment first; any other `409`,
 * a `400` or a `422` → the form alert with the server's message; network / 5xx → a transient
 * alert with Retry.
 */
export default class BillFormController {
  /**
   * Create a bill form controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {Function} options.setFieldErrors - React state setter for per-field errors.
   * @param {Function} options.setSubmitError - React state setter for the classified error.
   * @param {Function} options.setPending - React state setter for the in-flight flag.
   * @param {Function} options.setConfirming - Opens / closes the Delete confirmation.
   * @param {Function} options.onNotFound - Called on a `404`.
   * @param {Function} [options.navigate] - Navigation override, for testability.
   * @param {typeof BillsClient} [options.client] - HTTP client override.
   */
  constructor({
    context, setFieldErrors, setSubmitError, setPending, setConfirming, onNotFound,
    navigate: navigateTo = navigate, client = BillsClient,
  }) {
    this.context = context;
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setPending = setPending;
    this.setConfirming = setConfirming;
    this.onNotFound = onNotFound;
    this.navigate = navigateTo;
    this.client = client;
  }

  /**
   * Build the hash a bill page returns to: its provider's detail page, or the providers list
   * without a provider.
   *
   * @param {number|string} [providerId] - The provider id.
   * @returns {string} The hash in the controller's context.
   */
  returnHash(providerId) {
    return contextHash(this.context, providerId ? `${PROVIDERS_BASE}/${providerId}` : PROVIDERS_BASE);
  }

  /**
   * Validate and create the bill, then go to its provider.
   *
   * @param {object} fields - Current form field values.
   * @param {string} currency - The selected provider's currency.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async create(fields, currency) {
    await this.submit(validateBillFields(fields, { currency }), (body) => this.client.createBill(this.context, body));
  }

  /**
   * Validate and update the bill (changed fields only), then go to its provider.
   *
   * @param {object} bill - The loaded bill (the original values).
   * @param {object} fields - Current form field values.
   * @param {string} currency - The selected provider's currency.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async update(bill, fields, currency) {
    const validation = validateBillFields(fields, { currency });

    if (validation.body) {
      const original = validateBillFields(billFieldsFromBill(bill), { currency }).body ?? {};

      validation.body = changedBillFields(validation.body, original);

      if (Object.keys(validation.body).length === 0) {
        this.setFieldErrors({});
        this.navigate(this.returnHash(bill.provider_account?.id));
        return;
      }
    }

    await this.submit(validation, (body) => this.client.updateBill(this.context, bill.id, body));
  }

  /**
   * Delete the bill (after the page's confirmation), then go to its provider.
   *
   * @param {object} bill - The loaded bill.
   * @returns {Promise<void>} Resolves once handled.
   */
  async destroy(bill) {
    this.setSubmitError(null);
    this.setPending(true);

    try {
      const reply = await this.client.deleteBill(this.context, bill.id);

      this.setPending(false);
      this.setConfirming(false);

      if (reply !== undefined) {
        this.navigate(this.returnHash(bill.provider_account?.id));
      }
    } catch (error) {
      this.setConfirming(false);
      this.handleError(error, () => this.destroy(bill));
    }
  }

  /**
   * Run a validated submission.
   *
   * @param {{errors: object, body: (object|null)}} validation - The client-side validation.
   * @param {Function} request - Called with the body; resolves the bill.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async submit({ errors, body }, request) {
    this.setFieldErrors(errors);

    if (!body) {
      return;
    }

    this.setSubmitError(null);
    this.setPending(true);

    try {
      const bill = await request(body);

      if (!bill) {
        this.setPending(false);
        return;
      }

      this.navigate(this.returnHash(bill.provider_account?.id));
    } catch (error) {
      this.handleError(error, () => this.submit({ errors, body }, request));
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

    if (classified.kind === 'notFound') {
      this.onNotFound();
      return;
    }

    if (classified.code === 'BILL_PAID') {
      this.setSubmitError({ ...classified, message: BILL_PAID_MESSAGE, messages: [BILL_PAID_MESSAGE] });
      return;
    }

    this.setSubmitError(classified.kind === 'transient' ? { ...classified, retry } : classified);
  }
}
