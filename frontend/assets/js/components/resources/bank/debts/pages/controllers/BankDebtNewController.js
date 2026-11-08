import BankDebtFormController from './BankDebtFormController.js';

/**
 * Controller for the New debt page.
 */
export default class BankDebtNewController extends BankDebtFormController {
  /**
   * Validate and create the debt, then go to its detail page.
   *
   * @param {object} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(fields) {
    await this.create(fields);
  }
}
