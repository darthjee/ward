import AccountFormController from '../../../common/form/controllers/AccountFormController.js';
import { PROVIDERS_BASE } from '../../../common/sections.js';
import {
  changedProviderFields,
  providerFieldsFromAccount,
  validateProviderFields,
} from './providerFormFields.js';

/**
 * Shared submit flow of the provider forms (create and edit), under the Providers section.
 *
 * @description Plugs the provider fields into the shared account form flow: validation nests
 * the provider fields as `provider_expense`; an edit sends only the changed common fields and
 * the changed `provider_expense` keys; requests go through the provider client calls
 * (`type: "provider_expense"` on create, never `type` on PATCH). Saving goes to
 * `<ui>/bank/providers/:id`.
 */
export default class BankProviderFormController extends AccountFormController {
  /**
   * Create the controller under the Providers section.
   *
   * @param {object} options - Controller dependencies (see `AccountFormController`).
   */
  constructor(options) {
    super({ ...options, base: PROVIDERS_BASE });
  }

  /**
   * Validate the provider form.
   *
   * @param {object} fields - The form fields.
   * @param {{nameOnly: boolean}} [options] - `nameOnly` on an archived provider.
   * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
   */
  validate(fields, options) {
    return validateProviderFields(fields, options);
  }

  /**
   * Build the provider form fields of a loaded provider.
   *
   * @param {object} account - The provider-expense account.
   * @returns {object} The form fields.
   */
  fieldsFrom(account) {
    return providerFieldsFromAccount(account);
  }

  /**
   * Keep the changed common fields and the changed `provider_expense` keys.
   *
   * @param {object} body - The validated body.
   * @param {object} original - The body built from the loaded provider.
   * @returns {object} The PATCH body.
   */
  changes(body, original) {
    return changedProviderFields(body, original);
  }

  /**
   * Create the provider (`type: "provider_expense"` with its `provider_expense` object).
   *
   * @param {object} body - The validated body.
   * @returns {Promise<object|undefined>} The created provider.
   */
  sendCreate(body) {
    return this.client.createProviderExpense(this.context, body);
  }

  /**
   * Update the provider (common fields and `provider_expense`, never `type`).
   *
   * @param {number|string} accountId - The account id.
   * @param {object} body - The PATCH body.
   * @returns {Promise<object|undefined>} The updated provider.
   */
  sendUpdate(accountId, body) {
    return this.client.updateProviderExpense(this.context, accountId, body);
  }
}
