import BillsClient from '../../../../../../client/BillsClient.js';
import CalendarClient, { SKIP_BODY, paymentBody } from '../../../../../../client/CalendarClient.js';
import { classifyError } from '../../../common/bankErrors.js';
import { payingAccountOptions } from '../../../common/form/controllers/scheduleFields.js';
import { initialPayFields, validatePayFields } from '../payFields.js';

/**
 * Controller of the Calendar's Pay / Skip / Undo actions, shared by the list and month views.
 *
 * @description A derived entry (`debt` / `provider`) goes through the account routes with the
 * nominal date in the path; a one-off entry (`bill`) through the bill routes. After a success,
 * or a `409` / `404` (the entry changed elsewhere), the dialog closes and `onChanged` reloads
 * the view. A network / 5xx failure closes the dialog and shows the alert with Retry; a
 * validation failure of the Pay dialog keeps it open with the error.
 */
export default class CalendarActionsController {
  /**
   * Create the controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {Function} options.setDialog - Sets the open dialog (`{type, occurrence}` or `null`).
   * @param {Function} options.setFields - Sets the Pay dialog fields.
   * @param {Function} options.setFieldErrors - Sets the Pay dialog field errors.
   * @param {Function} options.setPending - Sets the in-flight flag.
   * @param {Function} options.setError - Sets the classified error.
   * @param {Function} options.onChanged - Called when the view must reload.
   * @param {typeof CalendarClient} [options.client] - Calendar client override.
   * @param {typeof BillsClient} [options.billsClient] - Bills client override (undo).
   */
  constructor({
    context, setDialog, setFields, setFieldErrors, setPending, setError, onChanged,
    client = CalendarClient, billsClient = BillsClient,
  }) {
    this.context = context;
    this.setDialog = setDialog;
    this.setFields = setFields;
    this.setFieldErrors = setFieldErrors;
    this.setPending = setPending;
    this.setError = setError;
    this.onChanged = onChanged;
    this.client = client;
    this.billsClient = billsClient;
  }

  /**
   * Open the Pay dialog with its initial fields.
   *
   * @param {object} occ - The occurrence.
   * @param {Array<object>|null} accounts - The loaded paying accounts.
   * @returns {void} Nothing.
   */
  openPay(occ, accounts) {
    this.setError(null);
    this.setFieldErrors({});
    this.setFields(initialPayFields(occ, payingAccountOptions(accounts, occ.currency)));
    this.setDialog({ type: 'pay', occurrence: occ });
  }

  /**
   * Open the Skip or Undo confirmation.
   *
   * @param {string} type - `skip` or `undo`.
   * @param {object} occ - The occurrence.
   * @returns {void} Nothing.
   */
  openConfirm(type, occ) {
    this.setError(null);
    this.setDialog({ type, occurrence: occ });
  }

  /**
   * Close the open dialog.
   *
   * @returns {void} Nothing.
   */
  close() {
    this.setPending(false);
    this.setDialog(null);
  }

  /**
   * Send a payment body to the route matching the entry.
   *
   * @param {object} occ - The occurrence.
   * @param {object} body - The payment body.
   * @returns {Promise<object|undefined>} The response body.
   */
  sendPayment(occ, body) {
    if (occ.kind === 'bill') {
      return this.client.payBill(this.context, occ.bill.id, body);
    }

    return this.client.payOccurrence(this.context, occ.source_account.id, occ.nominal_date, body);
  }

  /**
   * Send the undo request matching the entry.
   *
   * @param {object} occ - The occurrence.
   * @returns {Promise<object|undefined>} The response body.
   */
  sendUndo(occ) {
    if (occ.kind === 'bill') {
      return this.billsClient.undoBillPayment(this.context, occ.bill.id);
    }

    return this.billsClient.undoOccurrencePayment(this.context, occ.source_account.id, occ.nominal_date);
  }

  /**
   * Validate the Pay dialog and pay the entry.
   *
   * @param {object} occ - The occurrence.
   * @param {object} fields - The dialog fields.
   * @returns {Promise<void>} Resolves once handled.
   */
  async confirmPay(occ, fields) {
    const { errors, values } = validatePayFields(fields, occ);

    this.setFieldErrors(errors);

    if (values) {
      await this.run(occ, () => this.sendPayment(occ, paymentBody(occ, values)));
    }
  }

  /**
   * Skip the entry.
   *
   * @param {object} occ - The occurrence.
   * @returns {Promise<void>} Resolves once handled.
   */
  async confirmSkip(occ) {
    await this.run(occ, () => this.sendPayment(occ, SKIP_BODY));
  }

  /**
   * Undo the entry's payment (or skip).
   *
   * @param {object} occ - The occurrence.
   * @returns {Promise<void>} Resolves once handled.
   */
  async confirmUndo(occ) {
    await this.run(occ, () => this.sendUndo(occ));
  }

  /**
   * Run a request, then reload on success.
   *
   * @param {object} occ - The occurrence.
   * @param {Function} request - Sends the request.
   * @returns {Promise<void>} Resolves once handled.
   */
  async run(occ, request) {
    this.setError(null);
    this.setPending(true);

    try {
      const reply = await request();

      this.close();

      if (reply !== undefined) {
        this.onChanged();
      }
    } catch (error) {
      this.handleError(error, () => this.run(occ, request));
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

    if (classified.kind === 'validation') {
      this.setError(classified);
      return;
    }

    this.close();

    if (classified.kind === 'transient') {
      this.setError({ ...classified, retry });
      return;
    }

    // The alert hides a `notFound`; here the entry changed elsewhere, so its message is shown
    // like a conflict and the view reloads.
    this.setError(classified.kind === 'notFound' ? { ...classified, kind: 'conflict' } : classified);
    this.onChanged();
  }
}
