import { readField } from './AccountFormInput.jsx';

/**
 * One labelled select of an account form, with its inline error.
 *
 * @description The value comes from `state.fields[name]` and the error from
 * `state.fieldErrors[name]`; the select id is `state.idPrefix + name`. A `placeholder` adds an
 * empty first option; `disabled` locks the select.
 * @param {{name: string, label: string, options: Array<Array<string>>, placeholder: string,
 *   state: object, onChange: Function, disabled: boolean}} props - The field name, label,
 *   `[value, label]` options, optional empty-option label, the form state, the change handler
 *   and whether the select is locked.
 * @returns {React.ReactElement} The field.
 */
export default function AccountFormSelect({
  name, label, options, placeholder, state, onChange, disabled = false,
}) {
  const error = readField(state.fieldErrors, name);
  const id = `${state.idPrefix}${name}`;

  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        className={`form-select${error ? ' is-invalid' : ''}`}
        value={String(readField(state.fields, name) ?? '')}
        onChange={onChange}
        disabled={disabled}
      >
        {placeholder === undefined ? null : <option value="">{placeholder}</option>}
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
      {error && <div className="invalid-feedback">{error}</div>}
    </div>
  );
}
