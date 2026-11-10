import BankProviderFormController from './BankProviderFormController.js';

/**
 * Controller for the Edit provider page.
 *
 * @description See `AccountFormController#update`: an archived provider sends only `name`, an
 * active one only its changed fields (and changed `provider_expense` keys), and nothing
 * changed goes straight back to the detail.
 */
export default class BankProviderEditController extends BankProviderFormController {
  /**
   * Validate and update the provider, then go to its detail page.
   *
   * @param {number|string} accountId - The account id.
   * @param {object} fields - Current form field values.
   * @param {object} account - The loaded provider (the original values).
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(accountId, fields, account) {
    await this.update(accountId, fields, account);
  }
}
