/**
 * Read an own property of a possibly-missing object, without bracket access.
 *
 * @param {object|null} source - The object.
 * @param {string} name - The property name.
 * @returns {*} The value, or `undefined`.
 */
export function readField(source, name) {
  return source ? Object.getOwnPropertyDescriptor(source, name)?.value : undefined;
}

/**
 * One labelled input of an account form, with its inline error.
 *
 * @description The value comes from `state.fields[name]` and the error from
 * `state.fieldErrors[name]`; the input id is `state.idPrefix + name`.
 * @param {{name: string, label: string, type: string, extra: object, state: object,
 *   onChange: Function}} props - The field name, label, input type (`'textarea'` renders a
 *   textarea), extra input attributes, the form state and the change handler.
 * @returns {React.ReactElement} The field.
 */
export default function AccountFormInput({
  name, label, type = 'text', extra = {}, state, onChange,
}) {
  const error = readField(state.fieldErrors, name);
  const id = `${state.idPrefix}${name}`;
  const Tag = type === 'textarea' ? 'textarea' : 'input';

  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={id}>{label}</label>
      <Tag
        id={id}
        name={name}
        type={type === 'textarea' ? undefined : type}
        className={`form-control${error ? ' is-invalid' : ''}`}
        value={readField(state.fields, name) ?? ''}
        onChange={onChange}
        {...extra}
      />
      {error && <div className="invalid-feedback">{error}</div>}
    </div>
  );
}
