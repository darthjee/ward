import CurrencySelect from '../../../common/CurrencySelect.jsx';
import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import { localToday } from '../../../common/dates.js';

/** Warning shown when `settings.json` failed: the currency has no default. */
export const SETTINGS_WARNING = 'Could not load the default currency. Please choose one.';

/** Notice shown on an archived account's edit page. */
export const ARCHIVED_NOTICE = 'This account is archived: only its name can change.';

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
 * Render one labelled input with its inline error.
 *
 * @param {{name: string, label: string, type: string, extra: object}} field - The field.
 * @param {object} state - Form state (`fields`, `fieldErrors`, `idPrefix`).
 * @param {Function} onChange - Change handler (reads the input's `name`).
 * @returns {React.ReactElement} The field.
 */
function renderInput({
  name, label, type = 'text', extra = {},
}, state, onChange) {
  const error = readField(state.fieldErrors, name);
  const id = `${state.idPrefix}${name}`;
  const Tag = type === 'textarea' ? 'textarea' : 'input';

  return (
    <div className="mb-3" key={name}>
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

/**
 * Render the warning shown when the default currency could not be loaded.
 *
 * @param {boolean} settingsFailed - Whether `settings.json` failed.
 * @returns {React.ReactElement|null} The warning, or `null`.
 */
function renderSettingsWarning(settingsFailed) {
  if (!settingsFailed) {
    return null;
  }

  return <div className="alert alert-warning py-2 small">{SETTINGS_WARNING}</div>;
}

/**
 * Render every field of a non-archived account.
 *
 * @param {object} state - Form state.
 * @param {object} handlers - Field handlers.
 * @returns {React.ReactElement} The fields.
 */
function renderFullFields(state, handlers) {
  const { onFieldChange } = handlers;

  return (
    <>
      {renderInput({ name: 'name', label: 'Name' }, state, onFieldChange)}
      {renderInput({ name: 'bank_name', label: 'Bank' }, state, onFieldChange)}
      {renderInput({ name: 'branch', label: 'Branch' }, state, onFieldChange)}
      {renderInput({ name: 'account_number', label: 'Account number' }, state, onFieldChange)}
      {renderSettingsWarning(state.settingsFailed)}
      <CurrencySelect
        value={state.fields.currency}
        defaultCode={state.defaultCurrency}
        onChange={handlers.onCurrencyChange}
        locked={state.currencyLocked}
        error={readField(state.fieldErrors, 'currency') ?? null}
        idPrefix={state.idPrefix}
      />
      {renderInput({
        name: 'opening_date', label: 'Opening date', type: 'date', extra: { max: localToday() },
      }, state, onFieldChange)}
      {renderInput({
        name: 'opening_balance', label: 'Opening balance', extra: { inputMode: 'decimal' },
      }, state, onFieldChange)}
      {renderInput({ name: 'notes', label: 'Notes', type: 'textarea' }, state, onFieldChange)}
    </>
  );
}

/**
 * Render the fields of an archived account: the name only.
 *
 * @param {object} state - Form state.
 * @param {object} handlers - Field handlers.
 * @returns {React.ReactElement} The fields.
 */
function renderNameOnly(state, handlers) {
  return (
    <>
      <div className="alert alert-secondary">{ARCHIVED_NOTICE}</div>
      {renderInput({ name: 'name', label: 'Name' }, state, handlers.onFieldChange)}
    </>
  );
}

/**
 * Render the form, or a loading notice until the fields are known.
 *
 * @param {object} state - Form state.
 * @param {object} handlers - Event handlers.
 * @param {{submitLabel: string, cancelHref: string}} options - Button label and cancel link.
 * @returns {React.ReactElement|null} The form.
 */
function renderForm(state, handlers, { submitLabel, cancelHref }) {
  if (!state.fields) {
    return state.loadError ? null : <p className="text-muted">Loading…</p>;
  }

  return (
    <form onSubmit={handlers.onSubmit} noValidate>
      <BankErrorAlert error={state.submitError} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
      {state.archived ? renderNameOnly(state, handlers) : renderFullFields(state, handlers)}
      <button type="submit" className="btn btn-primary me-2" disabled={state.pending}>{submitLabel}</button>
      <a className="btn btn-outline-secondary" href={cancelHref}>Cancel</a>
    </form>
  );
}

/**
 * Shared rendering helper for the account forms (create and edit).
 */
const BankAccountFormHelper = {
  /**
   * Render an account form page. `type` is never shown (always `regular` from this submenu).
   *
   * @param {{fields: (object|null), fieldErrors: object, submitError: (object|null),
   *   loadError: (object|null), pending: boolean, defaultCurrency: (string|null),
   *   settingsFailed: boolean, currencyLocked: boolean, archived: boolean, idPrefix: string}}
   *   state - Form state.
   * @param {{onSubmit: Function, onFieldChange: Function, onCurrencyChange: Function,
   *   onRetry: Function, onDismiss: Function, onRetryLoad: Function}} handlers - Event handlers.
   * @param {{heading: string, submitLabel: string, cancelHref: string}} options - Page heading,
   *   submit label and cancel link.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers, options) {
    return (
      <div className="container mt-4">
        <h1>{options.heading}</h1>
        <BankErrorAlert error={state.loadError} onRetry={handlers.onRetryLoad} />
        {renderForm(state, handlers, options)}
      </div>
    );
  },
};

export default BankAccountFormHelper;
