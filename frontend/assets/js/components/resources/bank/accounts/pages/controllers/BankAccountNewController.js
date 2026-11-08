import AccountFormController from '../../../common/form/controllers/AccountFormController.js';
import { ACCOUNTS_BASE } from '../../../common/sections.js';

/**
 * Controller for the New account page.
 */
export default class BankAccountNewController extends AccountFormController {
  /**
   * Create the controller under the Accounts section.
   *
   * @param {object} options - Controller dependencies (see `AccountFormController`).
   */
  constructor(options) {
    super({ ...options, base: ACCOUNTS_BASE });
  }

  /**
   * Validate and create the account, then go to its detail page.
   *
   * @param {object} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(fields) {
    await this.create(fields);
  }
}
