import AccountFormController from '../../../common/form/controllers/AccountFormController.js';
import { ACCOUNTS_BASE } from '../../../common/sections.js';

/**
 * Controller for the Edit account page.
 *
 * @description See `AccountFormController#update`: an archived account sends only `name`, an
 * active one only its changed fields, and nothing changed goes straight back to the detail.
 */
export default class BankAccountEditController extends AccountFormController {
  /**
   * Create the controller under the Accounts section.
   *
   * @param {object} options - Controller dependencies (see `AccountFormController`).
   */
  constructor(options) {
    super({ ...options, base: ACCOUNTS_BASE });
  }

  /**
   * Validate and update the account, then go to its detail page.
   *
   * @param {number|string} accountId - The account id.
   * @param {object} fields - Current form field values.
   * @param {object} account - The loaded account (the original values).
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(accountId, fields, account) {
    await this.update(accountId, fields, account);
  }
}
