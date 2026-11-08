import Button from 'react-bootstrap/cjs/Button.js';
import BankErrorAlert from '../../../common/BankErrorAlert.jsx';

/**
 * Read an own property of a possibly-missing object, without bracket access.
 *
 * @param {object|null} source - The object.
 * @param {string} name - The property name.
 * @returns {*} The value, or `undefined`.
 */
function readField(source, name) {
  return source ? Object.getOwnPropertyDescriptor(source, name)?.value : undefined;
}

/**
 * Render one labelled control with its inline error.
 *
 * @param {{name: string, label: string, type: string, extra: object, className: string}} field -
 *   The field.
 * @param {object} state - Form state.
 * @param {Function} onChange - Change handler (reads the input's `name`).
 * @returns {React.ReactElement} The control.
 */
function renderControl({
  name, label, type = 'text', extra = {}, className = 'col-md',
}, state, onChange) {
  const error = readField(state.form.fieldErrors, name);
  const id = `${state.idPrefix}${name}`;
  const Tag = type === 'textarea' ? 'textarea' : 'input';

  return (
    <div className={className} key={name}>
      <label className="form-label small" htmlFor={id}>{label}</label>
      <Tag
        id={id}
        name={name}
        type={type === 'textarea' ? undefined : type}
        className={`form-control form-control-sm${error ? ' is-invalid' : ''}`}
        value={readField(state.form.values, name) ?? ''}
        onChange={onChange}
        {...extra}
      />
      {error && <div className="invalid-feedback">{error}</div>}
    </div>
  );
}

/**
 * Render the two-state Out / In toggle.
 *
 * @param {string} direction - `'out'` or `'in'`.
 * @param {Function} onDirectionChange - Called with the picked direction.
 * @returns {React.ReactElement} The toggle.
 */
function renderDirection(direction, onDirectionChange) {
  const button = (value, label) => (
    <Button
      size="sm"
      variant={direction === value ? 'secondary' : 'outline-secondary'}
      aria-pressed={direction === value}
      onClick={() => onDirectionChange(value)}
    >
      {label}
    </Button>
  );

  return (
    <div className="col-auto">
      <span className="form-label small d-block">Direction</span>
      <div className="btn-group" role="group" aria-label="Direction">
        {button('out', 'Out')}
        {button('in', 'In')}
      </div>
    </div>
  );
}

/**
 * Render the notes field, revealed by the Notes toggle.
 *
 * @param {object} state - Form state.
 * @param {Function} onChange - Change handler.
 * @returns {React.ReactElement|null} The notes field, or `null` while hidden.
 */
function renderNotes(state, onChange) {
  if (!state.form.notesOpen) {
    return null;
  }

  return (
    <div className="row mt-2">
      {renderControl({ name: 'notes', label: 'Notes', type: 'textarea' }, state, onChange)}
    </div>
  );
}

/**
 * Render the Save / Add and Cancel buttons.
 *
 * @param {object} form - The form state.
 * @param {object} handlers - `onToggleNotes` / `onCancelEdit`.
 * @returns {React.ReactElement} The buttons.
 */
function renderButtons(form, handlers) {
  return (
    <div className="mt-2 d-flex gap-2">
      <button type="submit" className="btn btn-sm btn-primary" disabled={form.pending}>
        {form.editing ? 'Save' : 'Add'}
      </button>
      {form.editing && <Button size="sm" variant="outline-secondary" onClick={handlers.onCancelEdit}>Cancel</Button>}
      <Button size="sm" variant="link" aria-expanded={form.notesOpen} onClick={handlers.onToggleNotes}>
        {form.notesOpen ? 'Hide notes' : 'Notes'}
      </Button>
    </div>
  );
}

/**
 * Rendering helper for the ledger's inline form row.
 */
const LedgerFormHelper = {
  /**
   * Render the inline form: date (capped at local today), Out / In toggle, amount,
   * description and the Notes toggle. Editing shows "Editing …" with Save / Cancel. Row errors
   * (client checks or a backend 400) are shown on the form, which keeps its values.
   *
   * @param {{form: object, today: string, idPrefix: string}} state - The form state, local
   *   today and the id prefix.
   * @param {object} handlers - `onSubmit`, `onFieldChange`, `onDirectionChange`,
   *   `onToggleNotes`, `onCancelEdit`.
   * @returns {React.ReactElement} The rendered form.
   */
  render(state, handlers) {
    const { form } = state;
    const title = form.editing ? `Editing “${form.editing.description}”` : 'New transaction';

    return (
      <form className="card card-body mb-3" onSubmit={handlers.onSubmit} noValidate>
        <h2 className="h6 text-break">{title}</h2>
        <BankErrorAlert error={form.error} />
        <div className="row g-2 align-items-start">
          {renderControl({
            name: 'date', label: 'Date', type: 'date', extra: { max: state.today }, className: 'col-md-auto',
          }, state, handlers.onFieldChange)}
          {renderDirection(form.values.direction, handlers.onDirectionChange)}
          {renderControl({
            name: 'amount', label: 'Amount', extra: { inputMode: 'decimal' }, className: 'col-md-2',
          }, state, handlers.onFieldChange)}
          {renderControl({ name: 'description', label: 'Description' }, state, handlers.onFieldChange)}
        </div>
        {renderNotes(state, handlers.onFieldChange)}
        {renderButtons(form, handlers)}
      </form>
    );
  },
};

export default LedgerFormHelper;
