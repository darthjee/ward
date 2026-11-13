import AccountFormHelper, {
  ARCHIVED_NOTICE,
  SETTINGS_WARNING,
} from '../../../common/form/helpers/AccountFormHelper.jsx';
import BankExtrasHelper from '../../../common/form/helpers/BankExtrasHelper.jsx';
import AccountFormCheckbox from '../../../common/form/AccountFormCheckbox.jsx';
import AccountFormInput from '../../../common/form/AccountFormInput.jsx';
import AccountFormSelect from '../../../common/form/AccountFormSelect.jsx';
import ScheduleFieldsHelper from '../../../common/form/helpers/ScheduleFieldsHelper.jsx';
import { monthName } from '../../../common/dates.js';
import { FREQUENCY_OPTIONS, PROVIDER_FIELD_LABELS } from '../../common/providerLabels.js';

export { ARCHIVED_NOTICE, SETTINGS_WARNING };

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => [String(index + 1), monthName(index + 1)]);

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
 * Render the due month select, shown only for a yearly frequency.
 *
 * @param {object} state - Form state.
 * @param {Function} onChange - Change handler.
 * @returns {React.ReactElement|null} The select, or `null` for a monthly frequency.
 */
function renderDueMonth(state, onChange) {
  if (state.fields.charge_frequency !== 'yearly') {
    return null;
  }

  return (
    <AccountFormSelect
      name="due_month"
      label="Due month"
      options={MONTH_OPTIONS}
      placeholder="Choose…"
      state={state}
      onChange={onChange}
    />
  );
}

/**
 * Render the provider fields: For accountant, provider tax id, expected amount, frequency,
 * due day, due month (yearly only) and the schedule inputs.
 *
 * @param {object} state - Form state.
 * @param {{onFieldChange: Function}} handlers - Field handlers.
 * @returns {React.ReactElement} The fields.
 */
function renderProviderFields(state, handlers) {
  const { onFieldChange } = handlers;

  return (
    <fieldset>
      <legend className="h5">Provider</legend>
      <AccountFormCheckbox name="for_accountant" label="For accountant (business expense)" state={state} onChange={onFieldChange} />
      <AccountFormInput name="provider_tax_id" label="Provider tax id" extra={{ maxLength: 32 }} state={state} onChange={onFieldChange} />
      <AccountFormInput name="expected_amount" label="Expected amount" extra={{ inputMode: 'decimal' }} state={state} onChange={onFieldChange} />
      <AccountFormSelect name="charge_frequency" label="Frequency" options={FREQUENCY_OPTIONS} state={state} onChange={onFieldChange} />
      <AccountFormInput name="due_day" label="Due day" extra={{ inputMode: 'numeric' }} state={state} onChange={onFieldChange} />
      {renderDueMonth(state, onFieldChange)}
      {ScheduleFieldsHelper.render(state, handlers)}
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
