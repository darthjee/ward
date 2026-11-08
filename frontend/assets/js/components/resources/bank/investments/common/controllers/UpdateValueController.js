import BankClient from '../../../../../../client/BankClient.js';
import { isZeroAmount, parseAmount, subtractAmounts } from '../../../common/amounts.js';
import { classifyError } from '../../../common/bankErrors.js';
import { isAfterLocalToday, localToday } from '../../../common/dates.js';

/** Notice shown when the typed current value equals the balance. */
export const VALUE_UNCHANGED = 'Value unchanged';

/** Description of the transaction posted by Update value. */
export const YIELD_DESCRIPTION = 'Yield';

/**
 * Build the initial Update value form state: no value, today's date.
 *
 * @param {string} [today] - Local today, `YYYY-MM-DD`.
 * @returns {{values: object, errors: object, pending: boolean, notice: (string|null),
 *   error: (object|null)}} The form state.
 */
export function initialUpdateValue(today = localToday()) {
  return {
    values: { value: '', date: today }, errors: {}, pending: false, notice: null, error: null,
  };
}

/**
 * Validate the date: required, not after local today (the ledger date rule).
 *
 * @param {string} date - The `YYYY-MM-DD` date.
 * @param {Date} now - The current instant.
 * @returns {string|null} The error, or `null`.
 */
function dateError(date, now) {
  if (!date) {
    return 'Date is required';
  }

  return isAfterLocalToday(date, now) ? 'Date cannot be in the future' : null;
}

/**
 * Validate the Update value form and compute the yield to post: `current value − balance`.
 *
 * @description The current value is a non-negative amount in the account currency (zero
 * allowed); the difference is computed exactly in minor units (no float).
 * @param {{value: string, date: string}} values - The form values.
 * @param {{balance: string, currency: string}} account - The investment (its current balance).
 * @param {Date} [now] - The current instant.
 * @returns {{errors: object, amount: (string|null)}} The field errors and, when valid, the
 *   signed difference.
 */
export function validateUpdateValue(values, account, now = new Date()) {
  const parsed = parseAmount(values.value, { currency: account.currency, allowZero: true });
  const errors = Object.fromEntries([
    ['value', parsed.error ?? null],
    ['date', dateError(values.date, now)],
  ].filter(([, error]) => error));

  if (Object.keys(errors).length) {
    return { errors, amount: null };
  }

  return { errors, amount: subtractAmounts(parsed.value, account.balance, account.currency) };
}

/**
 * Controller of the investment's **Update value** form.
 *
 * @description On submit: validates, computes `current value − balance`; a zero difference
 * posts nothing and shows "Value unchanged"; otherwise, after asking before discarding the
 * inline form's unsaved changes, posts a "Yield" transaction for the difference (positive or
 * negative), resets the form and reloads the account and its ledger. A network / 5xx failure
 * shows the alert with Retry; a `404` / `409` shows its message (if any) and reloads.
 */
export default class UpdateValueController {
  /**
   * Create the controller.
   *
   * @param {object} options - Controller dependencies.
   * @param {object} options.context - The owner context.
   * @param {number|string} options.accountId - The account id.
   * @param {Function} options.update - Merges a patch into the form state.
   * @param {Function} options.reload - Reloads the account and the current ledger page.
   * @param {Function} [options.canDiscard] - Whether the inline form may be discarded (asks).
   * @param {Function} [options.resetLedgerForm] - Resets the inline form.
   * @param {typeof BankClient} [options.client] - HTTP client override.
   */
  constructor({
    context, accountId, update, reload, canDiscard = () => true, resetLedgerForm = () => undefined,
    client = BankClient,
  }) {
    this.context = context;
    this.accountId = accountId;
    this.update = update;
    this.reload = reload;
    this.canDiscard = canDiscard;
    this.resetLedgerForm = resetLedgerForm;
    this.client = client;
  }

  /**
   * Validate the form and post the yield (see the class description).
   *
   * @param {{value: string, date: string}} values - The form values.
   * @param {{balance: string, currency: string}} account - The investment.
   * @param {Date} [now] - The current instant.
   * @returns {Promise<void>} Resolves once handled.
   */
  async submit(values, account, now = new Date()) {
    const { errors, amount } = validateUpdateValue(values, account, now);

    if (amount === null) {
      this.update({ errors, notice: null });
      return;
    }

    if (isZeroAmount(amount)) {
      this.update({ errors: {}, notice: VALUE_UNCHANGED, error: null });
      return;
    }

    if (!this.canDiscard()) {
      return;
    }

    this.resetLedgerForm();
    await this.post({ date: values.date, amount, description: YIELD_DESCRIPTION }, () => this.submit(values, account, now));
  }

  /**
   * Post the yield transaction, then reset the form and reload.
   *
   * @param {{date: string, amount: string, description: string}} body - The transaction.
   * @param {Function} retry - Re-runs the submission.
   * @returns {Promise<void>} Resolves once handled.
   */
  async post(body, retry) {
    this.update({
      errors: {}, notice: null, error: null, pending: true,
    });

    try {
      const created = await this.client.createTransaction(this.context, this.accountId, body);

      if (created === undefined) {
        this.update({ pending: false });
        return;
      }

      this.update(initialUpdateValue());
      this.reload();
    } catch (error) {
      this.handleError(error, retry);
    }
  }

  /**
   * Handle a failed post (see the class description).
   *
   * @param {Error} error - The error thrown by the client.
   * @param {Function} retry - Re-runs the submission.
   * @returns {void} Nothing.
   */
  handleError(error, retry) {
    const classified = classifyError(error);

    if (classified.kind === 'transient') {
      this.update({ pending: false, error: { ...classified, retry } });
      return;
    }

    this.update({ pending: false, error: classified });

    if (classified.kind !== 'validation') {
      this.reload();
    }
  }
}
