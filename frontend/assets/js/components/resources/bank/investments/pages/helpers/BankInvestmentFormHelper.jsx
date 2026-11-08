import AccountFormHelper, {
  ARCHIVED_NOTICE,
  SETTINGS_WARNING,
} from '../../../common/form/helpers/AccountFormHelper.jsx';
import AccountFormInput from '../../../common/form/AccountFormInput.jsx';
import AccountFormSelect from '../../../common/form/AccountFormSelect.jsx';
import RatePeriodSelect from '../../../common/form/RatePeriodSelect.jsx';
import { KIND_OPTIONS } from '../../common/investmentLabels.js';
import { START_DATE_LABEL } from '../controllers/investmentFormFields.js';

export { ARCHIVED_NOTICE, SETTINGS_WARNING };

/** Investment labels of the common fields. */
const INVESTMENT_LABELS = {
  bank_name: 'Institution',
  opening_date: START_DATE_LABEL,
};

/**
 * Render the investment fields: kind, yield rate (and its period, once a rate is entered),
 * maturity date and liquidity (D+N).
 *
 * @param {object} state - Form state.
 * @param {{onFieldChange: Function}} handlers - Field handlers.
 * @returns {React.ReactElement} The fields.
 */
function renderInvestmentFields(state, { onFieldChange }) {
  return (
    <fieldset>
      <legend className="h5">Investment</legend>
      <AccountFormSelect name="kind" label="Kind" options={KIND_OPTIONS} placeholder="" state={state} onChange={onFieldChange} />
      <AccountFormInput name="yield_rate" label="Yield rate (%)" extra={{ inputMode: 'decimal' }} state={state} onChange={onFieldChange} />
      <RatePeriodSelect
        rateName="yield_rate"
        periodName="yield_period"
        label="Yield period"
        state={state}
        onChange={onFieldChange}
      />
      <AccountFormInput name="maturity_date" label="Maturity date" type="date" state={state} onChange={onFieldChange} />
      <AccountFormInput name="liquidity_days" label="Liquidity (D+N)" extra={{ inputMode: 'numeric' }} state={state} onChange={onFieldChange} />
    </fieldset>
  );
}

/**
 * Rendering helper for the investment forms (create and edit).
 */
const BankInvestmentFormHelper = {
  /**
   * Render an investment form page: the shared account form with the investment labels
   * (Institution, Start date), no opening-balance field (an investment always starts at `0`)
   * and the investment fields before the notes. `type` is never shown (always `investment`
   * from this submenu).
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
      labels: INVESTMENT_LABELS,
      omitOpeningBalance: true,
      renderExtraFields: renderInvestmentFields,
    });
  },
};

export default BankInvestmentFormHelper;
