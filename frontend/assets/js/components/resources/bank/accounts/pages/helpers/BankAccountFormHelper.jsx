import AccountFormHelper, {
  ARCHIVED_NOTICE,
  SETTINGS_WARNING,
} from '../../../common/form/helpers/AccountFormHelper.jsx';
import AccountFormInput from '../../../common/form/AccountFormInput.jsx';

export { ARCHIVED_NOTICE, SETTINGS_WARNING };

/**
 * Render the regular account's bank extras: branch and account number.
 *
 * @param {object} state - Form state.
 * @param {object} handlers - Field handlers.
 * @returns {React.ReactElement} The fields.
 */
function renderBankExtras(state, handlers) {
  return (
    <>
      <AccountFormInput name="branch" label="Branch" state={state} onChange={handlers.onFieldChange} />
      <AccountFormInput name="account_number" label="Account number" state={state} onChange={handlers.onFieldChange} />
    </>
  );
}

/**
 * Rendering helper for the regular account forms (create and edit).
 */
const BankAccountFormHelper = {
  /**
   * Render a regular account form page: the shared account form with branch and account number
   * after the bank. `type` is never shown (always `regular` from this submenu).
   *
   * @param {object} state - Form state (see `AccountFormHelper.render`).
   * @param {object} handlers - Event handlers (see `AccountFormHelper.render`).
   * @param {{heading: string, submitLabel: string, cancelHref: string}} options - Page heading,
   *   submit label and cancel link.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers, options) {
    return AccountFormHelper.render(state, handlers, { ...options, renderBankExtras });
  },
};

export default BankAccountFormHelper;
