import BankInvestmentFormController from './BankInvestmentFormController.js';

/**
 * Controller for the New investment page.
 */
export default class BankInvestmentNewController extends BankInvestmentFormController {
  /**
   * Validate and create the investment, then go to its detail page.
   *
   * @param {object} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(fields) {
    await this.create(fields);
  }
}
