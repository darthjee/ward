import BankDebtFormController from './BankDebtFormController.js';

/**
 * Controller for the Edit debt page.
 *
 * @description See `AccountFormController#update`: an archived debt sends only `name`, an
 * active one only its changed fields (and changed `debt` keys), and nothing changed goes
 * straight back to the detail.
 */
export default class BankDebtEditController extends BankDebtFormController {
  /**
   * Validate and update the debt, then go to its detail page.
   *
   * @param {number|string} accountId - The account id.
   * @param {object} fields - Current form field values.
   * @param {object} account - The loaded debt (the original values).
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(accountId, fields, account) {
    await this.update(accountId, fields, account);
  }
}
