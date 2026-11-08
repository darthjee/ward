import BankAccountFormController from './BankAccountFormController.js';
import { changedFields, fieldsFromAccount, validateAccountFields } from './accountFormFields.js';

/**
 * Controller for the Edit account page.
 *
 * @description On an archived account the PATCH body carries **only** `name` (any other field
 * answers `409 ACCOUNT_ARCHIVED`); otherwise only the changed fields are sent, so a locked
 * currency is never sent with a different value. Nothing changed → straight back to the detail.
 */
export default class BankAccountEditController extends BankAccountFormController {
  /**
   * Validate and update the account, then go to its detail page.
   *
   * @param {number|string} accountId - The account id.
   * @param {object} fields - Current form field values.
   * @param {object} account - The loaded account (the original values).
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(accountId, fields, account) {
    const nameOnly = Boolean(account.archived_at);
    const validation = validateAccountFields(fields, { nameOnly });

    if (validation.body && !nameOnly) {
      const original = validateAccountFields(fieldsFromAccount(account)).body;

      validation.body = changedFields(validation.body, original);
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
}
