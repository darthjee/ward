import AccountFormHelper, {
  ARCHIVED_NOTICE,
  SETTINGS_WARNING,
} from '../../../common/form/helpers/AccountFormHelper.jsx';
import BankExtrasHelper from '../../../common/form/helpers/BankExtrasHelper.jsx';
import AccountFormCheckbox from '../../../common/form/AccountFormCheckbox.jsx';
import AccountFormInput from '../../../common/form/AccountFormInput.jsx';
import { PROVIDER_FIELD_LABELS } from '../../common/providerLabels.js';

export { ARCHIVED_NOTICE, SETTINGS_WARNING };

/**
 * Render the provider's bank extras: the optional branch and the customer / contract number.
 *
 * @param {object} state - Form state.
 * @param {object} handlers - Field handlers.
 * @returns {React.ReactElement} The fields.
 */
function renderBankExtras(state, handlers) {
  return BankExtrasHelper.render(state, handlers, { labels: PROVIDER_FIELD_LABELS });
}

/**
 * Render the provider fields: For accountant and the provider tax id.
 *
 * @param {object} state - Form state.
 * @param {{onFieldChange: Function}} handlers - Field handlers.
 * @returns {React.ReactElement} The fields.
 */
function renderProviderFields(state, { onFieldChange }) {
  return (
    <fieldset>
      <legend className="h5">Provider</legend>
      <AccountFormCheckbox name="for_accountant" label="For accountant (business expense)" state={state} onChange={onFieldChange} />
      <AccountFormInput name="provider_tax_id" label="Provider tax id" extra={{ maxLength: 32 }} state={state} onChange={onFieldChange} />
    </fieldset>
  );
}

/**
 * Rendering helper for the provider forms (create and edit).
 */
const BankProviderFormHelper = {
  /**
   * Render a provider form page: the shared account form with "Bank" relabelled Provider, the
   * optional branch and the customer / contract number after it, and the provider fields
   * before the notes. The opening balance stays (the anchor, any sign). `type` is never shown
   * (always `provider_expense` from this submenu).
   *
   * @param {object} state - Form state (see `AccountFormHelper.render`).
   * @param {object} handlers - Event handlers (see `AccountFormHelper.render`).
   * @param {{heading: string, submitLabel: string, cancelHref: string}} options - Page heading,
   *   submit label and cancel link.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers, options) {
    return AccountFormHelper.render(state, handlers, {
      ...options,
      labels: { bank_name: PROVIDER_FIELD_LABELS.bankName },
      renderBankExtras,
      renderExtraFields: renderProviderFields,
    });
  },
};

export default BankProviderFormHelper;
