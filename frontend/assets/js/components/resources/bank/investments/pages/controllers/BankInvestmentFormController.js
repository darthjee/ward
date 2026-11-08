import AccountFormController from '../../../common/form/controllers/AccountFormController.js';
import { INVESTMENTS_BASE } from '../../../common/sections.js';
import {
  changedInvestmentFields,
  investmentFieldsFromAccount,
  validateInvestmentFields,
} from './investmentFormFields.js';

/**
 * Shared submit flow of the investment forms (create and edit), under the Investments section.
 *
 * @description Plugs the investment fields into the shared account form flow: validation nests
 * the investment fields as `investment` (opening balance always `0`); an edit sends only the
 * changed common fields and the changed `investment` keys (so the stored `0` opening balance is
 * never sent); requests go through the investment client calls (`type: "investment"` on create,
 * never `type` on PATCH). Saving goes to `<ui>/bank/investments/:id`.
 */
export default class BankInvestmentFormController extends AccountFormController {
  /**
   * Create the controller under the Investments section.
   *
   * @param {object} options - Controller dependencies (see `AccountFormController`).
   */
  constructor(options) {
    super({ ...options, base: INVESTMENTS_BASE });
  }

  /**
   * Validate the investment form.
   *
   * @param {object} fields - The form fields.
   * @param {{nameOnly: boolean}} [options] - `nameOnly` on an archived investment.
   * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
   */
  validate(fields, options) {
    return validateInvestmentFields(fields, options);
  }

  /**
   * Build the investment form fields of a loaded investment.
   *
   * @param {object} account - The investment account.
   * @returns {object} The form fields.
   */
  fieldsFrom(account) {
    return investmentFieldsFromAccount(account);
  }

  /**
   * Keep the changed common fields and the changed `investment` keys.
   *
   * @param {object} body - The validated body.
   * @param {object} original - The body built from the loaded investment.
   * @returns {object} The PATCH body.
   */
  changes(body, original) {
    return changedInvestmentFields(body, original);
  }

  /**
   * Create the investment (`type: "investment"` with its `investment` object).
   *
   * @param {object} body - The validated body.
   * @returns {Promise<object|undefined>} The created investment.
   */
  sendCreate(body) {
    return this.client.createInvestment(this.context, body);
  }

  /**
   * Update the investment (common fields and `investment`, never `type`).
   *
   * @param {number|string} accountId - The account id.
   * @param {object} body - The PATCH body.
   * @returns {Promise<object|undefined>} The updated investment.
   */
  sendUpdate(accountId, body) {
    return this.client.updateInvestment(this.context, accountId, body);
  }
}
