import AccountsClient from '../../../../../client/AccountsClient.js';
import DisplayLocale from '../../../../../utils/locale/DisplayLocale.js';
import AccountEditFormController from '../../../../common/forms/controllers/AccountEditFormController.js';

/**
 * Controller for the "My account" page: lets the logged-in user update their username, email,
 * password and display locale. The form is pre-filled from `GET /auth/account.json`; the
 * loaded values are the baseline, and only changes against it are sent. Username, email and
 * new-password changes need the current password; a locale-only change does not. The shared
 * submit/validate/payload flow lives in {@link AccountEditFormController}.
 */
export default class MyAccountController extends AccountEditFormController {
  baseline = { username: '', email: '', locale: null };

  /**
   * Create a My Account controller.
   *
   * @param {Function} setFields - React state setter for the form's field values.
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {Function} setSuccess - React state setter for the success confirmation flag.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setFields, setFieldErrors, setSubmitError, setSuccess, client = AccountsClient) {
    super(setFields, setFieldErrors, setSubmitError, setSuccess, client);
  }

  /**
   * Load the account and pre-fill the form; it also becomes the baseline for change detection.
   * A failure shows the error and leaves the fields blank.
   *
   * @returns {Promise<void>} Resolves once loading finishes; never rejects.
   */
  async load() {
    try {
      const account = await this.client.getAccount();

      this.baseline = {
        username: account.username, email: account.email, locale: account.locale ?? null,
      };
      this.setFields((current) => ({
        ...current,
        username: account.username,
        email: account.email,
        locale: account.locale ?? '',
      }));
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  /**
   * Validate and submit the My Account form: skips the API call on inline errors or when
   * nothing changed against the baseline; otherwise sends only the changes.
   *
   * @param {{username: string, email: string, locale: string, currentPassword: string,
   *   newPassword: string, newPasswordConfirmation: string}} fields - Current form values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(fields) {
    await this.submit(fields, (payload) => this.client.updateAccount(payload));
  }

  /**
   * Validate the form: the current password is required only when the username, email or new
   * password changed, on top of the shared email and new-password rules.
   *
   * @param {object} fields - Current form field values.
   * @returns {object} A map of field name to error message, empty when the form is valid.
   */
  validate(fields) {
    return {
      ...this.#validateCurrentPassword(fields),
      ...super.validate(fields),
    };
  }

  /**
   * Build the PATCH body from changes against the baseline.
   *
   * @param {object} fields - Current form field values.
   * @returns {object} The request body; `currentPassword` only when a protected field changed.
   */
  buildPayload(fields) {
    const payload = {
      ...this.#changed('username', fields.username),
      ...this.#changed('email', fields.email),
      ...(fields.newPassword && { newPassword: fields.newPassword }),
    };

    if (Object.keys(payload).length > 0) {
      payload.currentPassword = fields.currentPassword;
    }

    const locale = fields.locale || null;

    return locale === this.baseline.locale ? payload : { ...payload, locale };
  }

  /**
   * Whether the payload carries at least one updatable field.
   *
   * @param {object} payload - The request body built by {@link buildPayload}.
   * @returns {boolean} `true` when something changed.
   */
  hasUpdate(payload) {
    return super.hasUpdate(payload) || ('locale' in payload);
  }

  /**
   * Apply a successful save: write back username, email and locale, reset the baseline, clear
   * the password fields and update the live display locale.
   *
   * @param {{username: string, email: string, locale: (string|null)}} result - The response.
   * @returns {void} Nothing.
   */
  applySuccess(result) {
    const { username, email } = result;
    const locale = result.locale ?? null;

    this.baseline = { username, email, locale };
    this.setFields((current) => ({
      ...current, username, email, locale: locale ?? '', ...this.clearedFields(),
    }));
    DisplayLocale.set(locale);
    this.setSuccess(true);
  }

  /**
   * Also clear the current password after a successful save, on top of the new-password fields.
   *
   * @returns {object} A map of field name to its cleared value.
   */
  clearedFields() {
    return { currentPassword: '', ...super.clearedFields() };
  }

  /**
   * Map `422 INVALID_LOCALE` to the select's inline error; other errors behave as usual.
   *
   * @param {Error} error - The error thrown while submitting.
   * @returns {void} Nothing.
   */
  handleSubmitError(error) {
    if (error.status === 422 && error.code === 'INVALID_LOCALE') {
      this.setFieldErrors({ locale: 'Unsupported display locale' });
      return;
    }

    super.handleSubmitError(error);
  }

  #changed(name, value) {
    return value && value !== this.baseline[name] ? { [name]: value } : {};
  }

  #needsPassword(fields) {
    return Object.keys(this.#changed('username', fields.username)).length > 0
      || Object.keys(this.#changed('email', fields.email)).length > 0
      || Boolean(fields.newPassword);
  }

  #validateCurrentPassword(fields) {
    if (!this.#needsPassword(fields) || fields.currentPassword) {
      return {};
    }

    return { currentPassword: 'Current password is required' };
  }
}
