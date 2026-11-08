import BankClient from '../../../../../../client/BankClient.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { classifyError } from '../../bankErrors.js';
import { navigate } from '../../currentHash.js';
import { changedFields, fieldsFromAccount, validateAccountFields } from './accountFormFields.js';

/**
 * Shared submit flow of the account forms (create and edit), for every account section.
 *
 * @description The section base (`'/bank/accounts'`, `'/bank/debts'`) decides where a saved
 * account is shown. Subclasses adapt the form to their account type by overriding the hooks
 * `validate` (fields → `{ errors, body }`), `fieldsFrom` (account → fields), `changes`
 * (body vs. original → PATCH body) and `createBody` (validated body → POST body). Validates on
 * the client, sets `pending` while the request runs (so a double click
 * never sends twice), then navigates to the account's detail page — the write response carries a
 * masked account number, so it is never displayed. Errors are classified: `404` → Not-found;
 * `409 ACCOUNT_NAME_TAKEN` → a field error on `name` (values kept); any other `409` → the message
 * in an alert, then `onConflict` (the edit page reloads); `400` → its details; network / 5xx →
 * a transient alert with Retry.
 */
export default class AccountFormController {
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
   * @param {string} [options.base] - The section base path (default `'/bank/accounts'`).
   * @param {Function} [options.navigate] - Navigation override, for testability.
   * @param {typeof BankClient} [options.client] - HTTP client override.
   */
  constructor({
    context, setFieldErrors, setSubmitError, setPending, onNotFound,
    onConflict = () => undefined, base = '/bank/accounts', navigate: navigateTo = navigate,
    client = BankClient,
  }) {
    this.context = context;
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setPending = setPending;
    this.onNotFound = onNotFound;
    this.onConflict = onConflict;
    this.base = base;
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
    return contextHash(this.context, `${this.base}/${accountId}`);
  }

  /**
   * Validate the form fields (hook; default: the common account fields).
   *
   * @param {object} fields - The form fields.
   * @param {{nameOnly: boolean}} [options] - `nameOnly` on an archived account.
   * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
   */
  validate(fields, options) {
    return validateAccountFields(fields, options);
  }

  /**
   * Build the form fields of a loaded account (hook; default: the common account fields).
   *
   * @param {object} account - The account response.
   * @returns {object} The form fields.
   */
  fieldsFrom(account) {
    return fieldsFromAccount(account);
  }

  /**
   * Keep the body entries that differ from the original (hook; default: shallow comparison).
   *
   * @param {object} body - The validated body.
   * @param {object} original - The body built from the loaded account.
   * @returns {object} The PATCH body.
   */
  changes(body, original) {
    return changedFields(body, original);
  }

  /**
   * Build the create request body (hook; default: the validated body as-is).
   *
   * @param {object} body - The validated body.
   * @returns {object} The POST body.
   */
  createBody(body) {
    return body;
  }

  /**
   * Validate and create the account, then go to its detail page.
   *
   * @param {object} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async create(fields) {
    await this.submit(
      this.validate(fields),
      (body) => this.client.createAccount(this.context, this.createBody(body)),
    );
  }

  /**
   * Validate and update the account, then go to its detail page.
   *
   * @description On an archived account the PATCH body carries **only** `name` (any other field
   * answers `409 ACCOUNT_ARCHIVED`); otherwise only the changed fields are sent, so a locked
   * currency is never sent with a different value. Nothing changed → straight back to the detail.
   * @param {number|string} accountId - The account id.
   * @param {object} fields - Current form field values.
   * @param {object} account - The loaded account (the original values).
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async update(accountId, fields, account) {
    const nameOnly = Boolean(account.archived_at);
    const validation = this.validate(fields, { nameOnly });

    if (validation.body && !nameOnly) {
      const original = this.validate(this.fieldsFrom(account)).body;

      validation.body = this.changes(validation.body, original);
    }

    if (validation.body && Object.keys(validation.body).length === 0) {
      this.setFieldErrors({});
      this.navigate(this.detailHash(accountId));
      return;
    }

    await this.submit(
      validation,
      (body) => this.client.updateAccount(this.context, accountId, body),
      accountId,
    );
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
