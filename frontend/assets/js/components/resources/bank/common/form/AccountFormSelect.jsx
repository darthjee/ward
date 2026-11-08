import { readField } from './AccountFormInput.jsx';

/**
 * One labelled select of an account form, with its inline error.
 *
 * @description The value comes from `state.fields[name]` and the error from
 * `state.fieldErrors[name]`; the select id is `state.idPrefix + name`. A `placeholder` adds an
 * empty first option.
 * @param {{name: string, label: string, options: Array<Array<string>>, placeholder: string,
 *   state: object, onChange: Function}} props - The field name, label, `[value, label]`
 *   options, optional empty-option label, the form state and the change handler.
 * @returns {React.ReactElement} The field.
 */
export default function AccountFormSelect({
  name, label, options, placeholder, state, onChange,
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
      >
        {placeholder === undefined ? null : <option value="">{placeholder}</option>}
        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
      {error && <div className="invalid-feedback">{error}</div>}
    </div>
  );
}
