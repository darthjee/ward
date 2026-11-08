import CurrencySelect from '../../CurrencySelect.jsx';
import BankErrorAlert from '../../BankErrorAlert.jsx';
import { localToday } from '../../dates.js';
import AccountFormInput, { readField } from '../AccountFormInput.jsx';

/** Warning shown when `settings.json` failed: the currency has no default. */
export const SETTINGS_WARNING = 'Could not load the default currency. Please choose one.';

/** Notice shown on an archived account's edit page. */
export const ARCHIVED_NOTICE = 'This account is archived: only its name can change.';

/** Default labels of the common fields; sections override some (e.g. Debts' "Creditor"). */
const DEFAULT_LABELS = new Map([
  ['name', 'Name'],
  ['bank_name', 'Bank'],
  ['opening_date', 'Opening date'],
  ['opening_balance', 'Opening balance'],
  ['notes', 'Notes'],
]);

/**
 * Build the label lookup of a form: the defaults with the section's overrides on top.
 *
 * @param {object} [overrides] - Label overrides keyed by field name.
 * @returns {Map<string, string>} The labels.
 */
function buildLabels(overrides = {}) {
  return new Map([...DEFAULT_LABELS, ...Object.entries(overrides)]);
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
 * Render a section slot (extra fields), or nothing when the section has none.
 *
 * @param {Function|undefined} slot - Renders the extra fields from the state and handlers.
 * @param {object} state - Form state.
 * @param {object} handlers - Field handlers.
 * @returns {React.ReactNode} The slot content, or `null`.
 */
function renderSlot(slot, state, handlers) {
  return slot ? slot(state, handlers) : null;
}

/**
 * Render the opening-balance input, or nothing when the section omits it (e.g. Investments,
 * which always open at `0`).
 *
 * @param {object} state - Form state.
 * @param {Function} onChange - Change handler.
 * @param {Map<string, string>} labels - The form labels.
 * @param {boolean} [omit] - Whether to omit the input.
 * @returns {React.ReactElement|null} The input, or `null` when omitted.
 */
function renderOpeningBalance(state, onChange, labels, omit) {
  if (omit) {
    return null;
  }

  return (
    <AccountFormInput
      name="opening_balance"
      label={labels.get('opening_balance')}
      extra={{ inputMode: 'decimal' }}
      state={state}
      onChange={onChange}
    />
  );
}

/**
 * Render every field of a non-archived account: the common fields, with the section's bank
 * extras right after the bank and its extra fields before the notes.
 *
 * @param {object} state - Form state.
 * @param {object} handlers - Field handlers.
 * @param {object} options - Form options (`labels`, `omitOpeningBalance`, `renderBankExtras`,
 *   `renderExtraFields`).
 * @returns {React.ReactElement} The fields.
 */
function renderFullFields(state, handlers, options) {
  const { onFieldChange } = handlers;
  const labels = buildLabels(options.labels);

  return (
    <>
      <AccountFormInput name="name" label={labels.get('name')} state={state} onChange={onFieldChange} />
      <AccountFormInput name="bank_name" label={labels.get('bank_name')} state={state} onChange={onFieldChange} />
      {renderSlot(options.renderBankExtras, state, handlers)}
      {renderSettingsWarning(state.settingsFailed)}
      <CurrencySelect
        value={state.fields.currency}
        defaultCode={state.defaultCurrency}
        onChange={handlers.onCurrencyChange}
        locked={state.currencyLocked}
        error={readField(state.fieldErrors, 'currency') ?? null}
        idPrefix={state.idPrefix}
      />
      <AccountFormInput
        name="opening_date"
        label={labels.get('opening_date')}
        type="date"
        extra={{ max: localToday() }}
        state={state}
        onChange={onFieldChange}
      />
      {renderOpeningBalance(state, onFieldChange, labels, options.omitOpeningBalance)}
      {renderSlot(options.renderExtraFields, state, handlers)}
      <AccountFormInput name="notes" label={labels.get('notes')} type="textarea" state={state} onChange={onFieldChange} />
    </>
  );
}

/**
 * Render the fields of an archived account: the name only.
 *
 * @param {object} state - Form state.
 * @param {object} handlers - Field handlers.
 * @param {object} options - Form options (`labels`).
 * @returns {React.ReactElement} The fields.
 */
function renderNameOnly(state, handlers, options) {
  return (
    <>
      <div className="alert alert-secondary">{ARCHIVED_NOTICE}</div>
      <AccountFormInput name="name" label={buildLabels(options.labels).get('name')} state={state} onChange={handlers.onFieldChange} />
    </>
  );
}

/**
 * Render the form, or a loading notice until the fields are known.
 *
 * @param {object} state - Form state.
 * @param {object} handlers - Event handlers.
 * @param {object} options - Form options (`submitLabel`, `cancelHref`, labels and slots).
 * @returns {React.ReactElement|null} The form.
 */
function renderForm(state, handlers, options) {
  if (!state.fields) {
    return state.loadError ? null : <p className="text-muted">Loading…</p>;
  }

  return (
    <form onSubmit={handlers.onSubmit} noValidate>
      <BankErrorAlert error={state.submitError} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
      {state.archived ? renderNameOnly(state, handlers, options) : renderFullFields(state, handlers, options)}
      <button type="submit" className="btn btn-primary me-2" disabled={state.pending}>{options.submitLabel}</button>
      <a className="btn btn-outline-secondary" href={options.cancelHref}>Cancel</a>
    </form>
  );
}

/**
 * Rendering helper shared by every account form (create and edit; Accounts, Debts and
 * Investments).
 */
const AccountFormHelper = {
  /**
   * Render an account form page. `type` is never shown (each submenu fixes it).
   *
   * @param {{fields: (object|null), fieldErrors: object, submitError: (object|null),
   *   loadError: (object|null), pending: boolean, defaultCurrency: (string|null),
   *   settingsFailed: boolean, currencyLocked: boolean, archived: boolean, idPrefix: string}}
   *   state - Form state.
   * @param {{onSubmit: Function, onFieldChange: Function, onCurrencyChange: Function,
   *   onRetry: Function, onDismiss: Function, onRetryLoad: Function}} handlers - Event handlers.
   * @param {{heading: string, submitLabel: string, cancelHref: string, labels: object,
   *   omitOpeningBalance: boolean, renderBankExtras: Function, renderExtraFields: Function}}
   *   options - Page heading, submit label, cancel link, label overrides (by field name),
   *   whether to hide the opening-balance input and the section's optional slots, each called
   *   with `(state, handlers)`.
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

export default AccountFormHelper;
