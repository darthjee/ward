import { readField } from './AccountFormInput.jsx';

/**
 * One labelled checkbox of an account form (a Bootstrap `form-check`), with its inline error.
 *
 * @description Checked when `state.fields[name]` is truthy; the input id is
 * `state.idPrefix + name`. The change handler receives an event-like
 * `{ target: { name, value } }` whose `value` is a boolean, so it plugs into the forms'
 * `onFieldChange`.
 * @param {{name: string, label: string, state: object, onChange: Function}} props - The field
 *   name, label, the form state and the change handler.
 * @returns {React.ReactElement} The field.
 */
export default function AccountFormCheckbox({
  name, label, state, onChange,
}) {
  const error = readField(state.fieldErrors, name);
  const id = `${state.idPrefix}${name}`;

  return (
    <div className="mb-3 form-check">
      <input
        id={id}
        name={name}
        type="checkbox"
        className={`form-check-input${error ? ' is-invalid' : ''}`}
        checked={Boolean(readField(state.fields, name))}
        onChange={(event) => onChange({ target: { name, value: event.target.checked } })}
      />
      <label className="form-check-label" htmlFor={id}>{label}</label>
      {error && <div className="invalid-feedback">{error}</div>}
    </div>
  );
}
