import BankClient from '../../../../../../client/BankClient.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { classifyError } from '../../../common/bankErrors.js';
import { navigate } from '../../../common/currentHash.js';

/**
 * Shared submit flow of the account forms (create and edit).
 *
 * @description Validates on the client, sets `pending` while the request runs (so a double click
 * never sends twice), then navigates to the account's detail page — the write response carries a
 * masked account number, so it is never displayed. Errors are classified: `404` → Not-found;
 * `409 ACCOUNT_NAME_TAKEN` → a field error on `name` (values kept); any other `409` → the message
 * in an alert, then `onConflict` (the edit page reloads); `400` → its details; network / 5xx →
 * a transient alert with Retry.
 */
export default class BankAccountFormController {
  /**
   * Create a form controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {Function} options.setFieldErrors - React state setter for per-field errors.
   * @param {Function} options.setSubmitError - React state setter for the classified error.
   * @param {Function} options.setPending - React state setter for the in-flight flag.
   * @param {Function} options.onNotFound - Called on a `404`.
   * @param {Function} [options.onConflict] - Called after a `409` other than a name clash.
   * @param {Function} [options.navigate] - Navigation override, for testability.
   * @param {typeof BankClient} [options.client] - HTTP client override.
   */
  constructor({
    context, setFieldErrors, setSubmitError, setPending, onNotFound,
    onConflict = () => undefined, navigate: navigateTo = navigate, client = BankClient,
  }) {
    this.context = context;
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setPending = setPending;
    this.onNotFound = onNotFound;
    this.onConflict = onConflict;
    this.navigate = navigateTo;
    this.client = client;
  }

  /**
   * Build the detail hash of an account.
   *
   * @param {number|string} accountId - The account id.
   * @returns {string} The detail hash in the controller's context.
   */
  detailHash(accountId) {
    return contextHash(this.context, `/bank/accounts/${accountId}`);
  }

  /**
   * Run a validated submission.
   *
   * @param {{errors: object, body: (object|null)}} validation - The client-side validation.
   * @param {Function} request - Called with the body; resolves the account.
   * @param {number|string} [fallbackId] - Account id to navigate to when the response has none.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async submit({ errors, body }, request, fallbackId) {
    this.setFieldErrors(errors);

    if (!body) {
      return;
    }

    this.setSubmitError(null);
    this.setPending(true);

    try {
      const account = await request(body);

      if (!account) {
        this.setPending(false);
        return;
      }

      this.navigate(this.detailHash(account.id ?? fallbackId));
    } catch (error) {
      this.handleSubmitError(error);
    }
  }

  /**
   * Handle a failed request (see the class description).
   *
   * @param {Error} error - The error thrown by the client.
   * @returns {void} Nothing.
   */
  handleSubmitError(error) {
    const classified = classifyError(error);

    this.setPending(false);

    if (classified.kind === 'notFound') {
      this.onNotFound();
      return;
    }

    if (classified.code === 'ACCOUNT_NAME_TAKEN') {
      this.setFieldErrors({ name: classified.message });
      return;
    }

    this.setSubmitError(classified);

    if (classified.kind === 'conflict') {
      this.onConflict(classified);
    }
  }
}
