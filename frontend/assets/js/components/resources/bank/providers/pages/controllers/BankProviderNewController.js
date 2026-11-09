import BankProviderFormController from './BankProviderFormController.js';

/**
 * Controller for the New provider page.
 */
export default class BankProviderNewController extends BankProviderFormController {
  /**
   * Validate and create the provider, then go to its detail page.
   *
   * @param {object} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(fields) {
    await this.create(fields);
  }
}
