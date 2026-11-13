import AccountFormHelper, {
  ARCHIVED_NOTICE,
  SETTINGS_WARNING,
} from '../../../common/form/helpers/AccountFormHelper.jsx';
import AccountFormInput from '../../../common/form/AccountFormInput.jsx';
import AccountFormSelect from '../../../common/form/AccountFormSelect.jsx';
import ScheduleFieldsHelper from '../../../common/form/helpers/ScheduleFieldsHelper.jsx';
import RatePeriodSelect, { PERIOD_OPTIONS } from '../../../common/form/RatePeriodSelect.jsx';
import { monthName } from '../../../common/dates.js';

export { ARCHIVED_NOTICE, SETTINGS_WARNING };

/** Debt labels of the common fields. */
const DEBT_LABELS = {
  bank_name: 'Creditor',
  opening_date: 'Loan date',
  opening_balance: 'Amount owed',
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => [String(index + 1), monthName(index + 1)]);

/**
 * Render the due month select, shown only for a yearly frequency.
 *
 * @param {object} state - Form state.
 * @param {Function} onChange - Change handler.
 * @returns {React.ReactElement|null} The select, or `null` for a monthly frequency.
 */
function renderDueMonth(state, onChange) {
  if (state.fields.instalment_frequency !== 'yearly') {
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
 * Render the debt fields: interest rate (and its period), instalment amount, frequency, due
 * day, due month (yearly only), instalment count and the schedule inputs.
 *
 * @param {object} state - Form state.
 * @param {{onFieldChange: Function}} handlers - Field handlers.
 * @returns {React.ReactElement} The fields.
 */
function renderDebtFields(state, handlers) {
  const { onFieldChange } = handlers;

  return (
    <fieldset>
      <legend className="h5">Debt</legend>
      <AccountFormInput name="interest_rate" label="Interest rate (%)" extra={{ inputMode: 'decimal' }} state={state} onChange={onFieldChange} />
      <RatePeriodSelect
        rateName="interest_rate"
        periodName="interest_period"
        label="Interest period"
        state={state}
        onChange={onFieldChange}
      />
      <AccountFormInput name="instalment_amount" label="Instalment amount" extra={{ inputMode: 'decimal' }} state={state} onChange={onFieldChange} />
      <AccountFormSelect name="instalment_frequency" label="Frequency" options={PERIOD_OPTIONS} state={state} onChange={onFieldChange} />
      <AccountFormInput name="due_day" label="Due day" extra={{ inputMode: 'numeric' }} state={state} onChange={onFieldChange} />
      {renderDueMonth(state, onFieldChange)}
      <AccountFormInput name="instalment_count" label="Instalment count" extra={{ inputMode: 'numeric' }} state={state} onChange={onFieldChange} />
      {ScheduleFieldsHelper.render(state, handlers)}
    </fieldset>
  );
}

/**
 * Rendering helper for the debt forms (create and edit).
 */
const BankDebtFormHelper = {
  /**
   * Render a debt form page: the shared account form with the debt labels (Creditor, Loan
   * date, Amount owed — typed positive) and the debt fields before the notes. `type` is never
   * shown (always `debt` from this submenu).
   *
   * @param {object} state - Form state (see `AccountFormHelper.render`).
   * @param {object} handlers - Event handlers (see `AccountFormHelper.render`).
   * @param {{heading: string, submitLabel: string, cancelHref: string}} options - Page heading,
   *   submit label and cancel link.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers, options) {
    return AccountFormHelper.render(state, handlers, {
      ...options, labels: DEBT_LABELS, renderExtraFields: renderDebtFields,
    });
  },
};

export default BankDebtFormHelper;
