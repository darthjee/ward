import AccountFormCheckbox from '../../common/form/AccountFormCheckbox.jsx';
import AccountFormInput from '../../common/form/AccountFormInput.jsx';
import AccountFormSelect from '../../common/form/AccountFormSelect.jsx';
import { payingAccountOptions } from '../../common/form/controllers/scheduleFields.js';

const CHARGE_KINDS = ['provider', 'bill'];

/**
 * The fields of the Pay dialog: amount, paid on, paying account and, for provider / bill
 * entries only, the "record charge" checkbox.
 *
 * @param {{occurrence: object, accounts: (Array<object>|null), state: object,
 *   onChange: Function}} props - The occurrence, the loaded paying accounts, the form state
 *   (`fields`, `fieldErrors`) and the field change handler.
 * @returns {React.ReactElement} The fields.
 */
export default function PayForm({
  occurrence, accounts, state, onChange,
}) {
  const formState = { fields: state.fields, fieldErrors: state.fieldErrors, idPrefix: 'pay_' };

  return (
    <>
      <AccountFormInput name="amount" label="Amount" extra={{ inputMode: 'decimal' }} state={formState} onChange={onChange} />
      <AccountFormInput name="paid_on" label="Paid on" type="date" state={formState} onChange={onChange} />
      <AccountFormSelect
        name="paying_account_id"
        label="Paying account"
        options={payingAccountOptions(accounts, occurrence.currency)}
        placeholder="Select an account"
        state={formState}
        onChange={onChange}
      />
      {CHARGE_KINDS.includes(occurrence.kind) && (
        <AccountFormCheckbox name="record_charge" label="Record charge" state={formState} onChange={onChange} />
      )}
    </>
  );
}
