import { DISPLAY_LOCALES } from '../../../../utils/locale/locales.js';

/**
 * Display-locale select for the My Account form (`''` stands for "Browser default").
 *
 * @param {{value: string, error: (string|undefined), onChange: Function, id: string}} props -
 *   The current value, its inline error, the change handler and the input id.
 * @returns {React.ReactElement} The labelled select.
 */
export default function LocaleSelect({
  value, error, onChange, id,
}) {
  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={id}>Display locale</label>
      <select
        id={id}
        className={`form-select${error ? ' is-invalid' : ''}`}
        value={value}
        onChange={onChange}
      >
        {DISPLAY_LOCALES.map(({ value: optionValue, label }) => (
          <option key={optionValue ?? ''} value={optionValue ?? ''}>{label}</option>
        ))}
      </select>
      {error && <div className="invalid-feedback">{error}</div>}
    </div>
  );
}
