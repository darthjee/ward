import AccountFormController from '../../../common/form/controllers/AccountFormController.js';
import { DEBTS_BASE } from '../../../common/sections.js';
import { changedDebtFields, debtFieldsFromAccount, validateDebtFields } from './debtFormFields.js';

/**
 * Shared submit flow of the debt forms (create and edit), under the Debts section.
 *
 * @description Plugs the debt fields into the shared account form flow: validation negates the
 * Amount owed into `opening_balance` and nests the debt fields as `debt`; an edit sends only
 * the changed common fields and the changed `debt` keys; requests go through the debt client
 * calls (`type: "debt"` on create, never `type` on PATCH). Saving goes to `<ui>/bank/debts/:id`.
 */
export default class BankDebtFormController extends AccountFormController {
  /**
   * Create the controller under the Debts section.
   *
   * @param {object} options - Controller dependencies (see `AccountFormController`).
   */
  constructor(options) {
    super({ ...options, base: DEBTS_BASE });
  }

  /**
   * Validate the debt form.
   *
   * @param {object} fields - The form fields.
   * @param {{nameOnly: boolean}} [options] - `nameOnly` on an archived debt.
   * @returns {{errors: object, body: (object|null)}} The field errors and, when valid, the body.
   */
  validate(fields, options) {
    return validateDebtFields(fields, options);
  }

  /**
   * Build the debt form fields of a loaded debt.
   *
   * @param {object} account - The debt account.
   * @returns {object} The form fields.
   */
  fieldsFrom(account) {
    return debtFieldsFromAccount(account);
  }

  /**
   * Keep the changed common fields and the changed `debt` keys.
   *
   * @param {object} body - The validated body.
   * @param {object} original - The body built from the loaded debt.
   * @returns {object} The PATCH body.
   */
  changes(body, original) {
    return changedDebtFields(body, original);
  }

  /**
   * Create the debt (`type: "debt"` with its `debt` object).
   *
   * @param {object} body - The validated body.
   * @returns {Promise<object|undefined>} The created debt.
   */
  sendCreate(body) {
    return this.client.createDebt(this.context, body);
  }

  /**
   * Update the debt (common fields and `debt`, never `type`).
   *
   * @param {number|string} accountId - The account id.
   * @param {object} body - The PATCH body.
   * @returns {Promise<object|undefined>} The updated debt.
   */
  sendUpdate(accountId, body) {
    return this.client.updateDebt(this.context, accountId, body);
  }
}
