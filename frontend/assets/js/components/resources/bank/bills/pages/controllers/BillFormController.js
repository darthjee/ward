import ProviderBillsClient from '../../../../../../client/ProviderBillsClient.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { classifyError } from '../../../common/bankErrors.js';
import { navigate } from '../../../common/currentHash.js';
import { PROVIDERS_BASE } from '../../../common/sections.js';
import { billFieldsFromBill, changedBillFields, validateBillFields } from './billFormFields.js';

/** Message shown when a paid bill is changed or deleted (`409 BILL_PAID`). */
export const BILL_PAID_MESSAGE = 'This bill is paid: undo the payment first.';

/** Message of a recurring bill whose provider can't be changed. */
const PROVIDER_LOCKED_MESSAGE = "A recurring bill can't be moved to another provider.";

/** Message of a bill whose kind can't be changed. */
const KIND_LOCKED_MESSAGE = "A bill's kind can't be changed.";

/**
 * Where each error code is shown: on a field (`field`) or on the form alert (`form`), with the
 * message to display.
 */
const ERROR_PLACEMENTS = new Map([
  ['PROVIDER_BILL_NAME_TAKEN', { field: 'description', message: 'A recurring bill with this description already exists for this provider' }],
  ['CURRENCY_MISMATCH', { field: 'paying_account_id', message: "Account currency must match the provider's" }],
  ['ACCOUNT_NOT_FOUND', { field: 'paying_account_id', message: 'Account not available' }],
  ['PROVIDER_BILL_LIMIT', { message: 'This provider already has 50 recurring bills' }],
  ['ACCOUNT_ARCHIVED', { message: 'The provider is archived' }],
  ['PROVIDER_BILL_KIND_LOCKED', { message: KIND_LOCKED_MESSAGE }],
  ['PROVIDER_BILL_PROVIDER_LOCKED', { message: PROVIDER_LOCKED_MESSAGE }],
  ['PROVIDER_BILL_PAID', { message: BILL_PAID_MESSAGE }],
  ['BILL_PAID', { message: BILL_PAID_MESSAGE }],
]);

/**
 * Submit, update and delete flow of the provider bill pages (one-off and recurring) (`<ui>/bills/new`,
 * `<ui>/bills/:id/edit`).
 *
 * @description Validates on the client, sets `pending` while a request runs (so a double click
 * never sends twice), then goes to the bill's provider detail page. An edit sends only the
 * changed fields (nothing changed → straight back). Errors are classified: `404` → Not-found;
 * `409 BILL_PAID` → the form alert telling the user to undo the payment first; any other `409`,
 * a `400` or a `422` → the form alert with the server's message; network / 5xx → a transient
 * alert with Retry; a session-expired failure shows nothing (the login modal is already
 * open) and only resets the pending / confirmation state.
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
   * @param {typeof ProviderBillsClient} [options.client] - HTTP client override.
   */
  constructor({
    context, setFieldErrors, setSubmitError, setPending, setConfirming, onNotFound,
    navigate: navigateTo = navigate, client = ProviderBillsClient,
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
    await this.submit(validateBillFields(fields, { currency }), (body) => this.client.createProviderBill(this.context, body.provider_account_id, body));
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
    const validation = validateBillFields({ ...fields, kind: bill.kind }, { currency });

    if (validation.body) {
      const original = validateBillFields(billFieldsFromBill(bill), { currency }).body ?? {};

      validation.body = changedBillFields(validation.body, original);

      if (Object.keys(validation.body).length === 0) {
        this.setFieldErrors({});
        this.navigate(this.returnHash(bill.provider_account_id));
        return;
      }
    }

    await this.submit(validation, (body) => this.client.updateProviderBill(this.context, bill.id, body));
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
      await this.client.deleteProviderBill(this.context, bill.id);

      this.setPending(false);
      this.setConfirming(false);
      this.navigate(this.returnHash(bill.provider_account_id));
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

      this.navigate(this.returnHash(bill.provider_account_id));
    } catch (error) {
      this.handleError(error, () => this.submit({ errors, body }, request));
    }
  }

  /**
   * Show a mapped error code on its field or on the form alert.
   *
   * @param {object} classified - The classified error.
   * @returns {boolean} Whether the code is mapped (and so shown).
   */
  placeError(classified) {
    const placement = ERROR_PLACEMENTS.get(classified.code);

    if (!placement) {
      return false;
    }

    if (placement.field) {
      this.setFieldErrors({ [placement.field]: placement.message });
    } else {
      this.setSubmitError({ ...classified, message: placement.message, messages: [placement.message] });
    }

    return true;
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

    if (classified.kind === 'sessionExpired') {
      return;
    }

    if (classified.kind === 'notFound') {
      this.onNotFound();
      return;
    }

    if (this.placeError(classified)) {
      return;
    }

    this.setSubmitError(classified.kind === 'transient' ? { ...classified, retry } : classified);
  }
}
