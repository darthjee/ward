import AccountFormSelect from './AccountFormSelect.jsx';
import { readField } from './AccountFormInput.jsx';

/** The period options of a rate (debt interest, investment yield). */
export const PERIOD_OPTIONS = [['monthly', 'Monthly'], ['yearly', 'Yearly']];

/**
 * The period select paired with a rate field, shown only once a rate is entered (an empty rate
 * clears both, so there is nothing to choose).
 *
 * @param {{rateName: string, periodName: string, label: string, state: object,
 *   onChange: Function}} props - The rate and period field names, the select label, the form
 *   state and the change handler.
 * @returns {React.ReactElement|null} The select, or `null` while the rate is blank.
 */
export default function RatePeriodSelect({
  rateName, periodName, label, state, onChange,
}) {
  if (!String(readField(state.fields, rateName) ?? '').trim()) {
    return null;
  }

  return (
    <AccountFormSelect
      name={periodName}
      label={label}
      options={PERIOD_OPTIONS}
      placeholder="Choose…"
      state={state}
      onChange={onChange}
    />
  );
}
