import BankErrorAlert from '../../common/BankErrorAlert.jsx';
import { localToday } from '../../common/dates.js';
import { readField } from '../../common/form/AccountFormInput.jsx';

/**
 * One small labelled input of the Update value form, with its inline error.
 *
 * @param {{name: string, label: string, type: string, extra: object, state: object,
 *   onChange: Function}} props - The field name, label, input type, extra input attributes,
 *   the form state and the change handler.
 * @returns {React.ReactElement} The field.
 */
function UpdateValueField({
  name, label, type = 'text', extra = {}, state, onChange,
}) {
  const error = readField(state.errors, name);
  const id = `update-value-${name}`;

  return (
    <div>
      <label className="form-label small mb-0" htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        className={`form-control form-control-sm${error ? ' is-invalid' : ''}`}
        value={readField(state.values, name) ?? ''}
        onChange={onChange}
        {...extra}
      />
      {error && <div className="invalid-feedback">{error}</div>}
    </div>
  );
}

/**
 * Render the "Value unchanged" notice, or nothing.
 *
 * @param {string|null} notice - The notice.
 * @returns {React.ReactElement|null} The notice, or `null`.
 */
function renderNotice(notice) {
  if (!notice) {
    return null;
  }

  return <div className="small text-muted align-self-center" role="status">{notice}</div>;
}

/**
 * The investment's **Update value** form: the broker's current value (in the account currency)
 * and a date (default today). Submitting posts `current value − balance` as a "Yield"
 * transaction, or shows "Value unchanged" (see `UpdateValueController`).
 *
 * @param {{state: object, currency: string, handlers: {onUpdateValueChange: Function,
 *   onUpdateValueSubmit: Function, onUpdateValueDismiss: Function}}} props - The form state
 *   (`values`, `errors`, `pending`, `notice`, `error`), the account currency and the handlers.
 * @returns {React.ReactElement} The form.
 */
export default function UpdateValueForm({ state, currency, handlers }) {
  return (
    <form className="d-flex flex-wrap align-items-end gap-2 ms-sm-auto" aria-label="Update value" onSubmit={handlers.onUpdateValueSubmit} noValidate>
      <BankErrorAlert error={state.error} onRetry={state.error?.retry} onDismiss={handlers.onUpdateValueDismiss} />
      <UpdateValueField
        name="value"
        label={`Current value (${currency})`}
        extra={{ inputMode: 'decimal' }}
        state={state}
        onChange={handlers.onUpdateValueChange}
      />
      <UpdateValueField
        name="date"
        label="Date"
        type="date"
        extra={{ max: localToday() }}
        state={state}
        onChange={handlers.onUpdateValueChange}
      />
      <button type="submit" className="btn btn-sm btn-outline-primary" disabled={state.pending}>Update value</button>
      {renderNotice(state.notice)}
    </form>
  );
}
