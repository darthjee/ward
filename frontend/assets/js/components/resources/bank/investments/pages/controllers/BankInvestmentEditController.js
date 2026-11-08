import BankInvestmentFormController from './BankInvestmentFormController.js';

/**
 * Controller for the Edit investment page.
 *
 * @description See `AccountFormController#update`: an archived investment sends only `name`, an
 * active one only its changed fields (and changed `investment` keys), and nothing changed goes
 * straight back to the detail.
 */
export default class BankInvestmentEditController extends BankInvestmentFormController {
  /**
   * Validate and update the investment, then go to its detail page.
   *
   * @param {number|string} accountId - The account id.
   * @param {object} fields - Current form field values.
   * @param {object} account - The loaded investment (the original values).
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(accountId, fields, account) {
    await this.update(accountId, fields, account);
  }
}
