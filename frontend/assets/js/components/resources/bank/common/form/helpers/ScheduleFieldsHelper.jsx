import AccountFormCheckbox from '../AccountFormCheckbox.jsx';
import AccountFormInput from '../AccountFormInput.jsx';
import AccountFormSelect from '../AccountFormSelect.jsx';
import { payingAccountOptions } from '../controllers/scheduleFields.js';

/** Empty option of the Default paying account select (no default). */
export const NO_PAYING_ACCOUNT = 'None';

/**
 * Rendering helper of the schedule inputs shared by the debt and provider forms: Bills from,
 * Show in Calendar and Default paying account.
 */
const ScheduleFieldsHelper = {
  /**
   * Render the three schedule inputs.
   *
   * @description The Default paying account select lists the regular accounts in the form's
   * currency (`state.payingAccounts`, empty while loading), with an empty first option meaning
   * no default.
   * @param {object} state - Form state (`fields`, `fieldErrors`, `idPrefix`, `payingAccounts`).
   * @param {{onFieldChange: Function}} handlers - Field handlers.
   * @returns {React.ReactElement} The inputs.
   */
  render(state, { onFieldChange }) {
    const options = payingAccountOptions(state.payingAccounts, state.fields.currency);

    return (
      <>
        <AccountFormInput name="bills_from" label="Bills from" type="date" state={state} onChange={onFieldChange} />
        <AccountFormCheckbox name="show_in_calendar" label="Show in Calendar" state={state} onChange={onFieldChange} />
        <AccountFormSelect
          name="paying_account_id"
          label="Default paying account"
          options={options}
          placeholder={NO_PAYING_ACCOUNT}
          state={state}
          onChange={onFieldChange}
        />
      </>
    );
  },
};

export default ScheduleFieldsHelper;
