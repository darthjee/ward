import BankAccountFormController from './BankAccountFormController.js';
import { validateAccountFields } from './accountFormFields.js';

/**
 * Controller for the New account page.
 */
export default class BankAccountNewController extends BankAccountFormController {
  /**
   * Validate and create the account, then go to its detail page.
   *
   * @param {object} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(fields) {
    await this.submit(
      validateAccountFields(fields),
      (body) => this.client.createAccount(this.context, body),
    );
  }
}
