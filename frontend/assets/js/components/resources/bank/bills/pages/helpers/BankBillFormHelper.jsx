import Button from 'react-bootstrap/cjs/Button.js';
import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import ConfirmModal from '../../../common/ConfirmModal.jsx';
import AccountFormCheckbox from '../../../common/form/AccountFormCheckbox.jsx';
import AccountFormInput from '../../../common/form/AccountFormInput.jsx';
import AccountFormSelect from '../../../common/form/AccountFormSelect.jsx';
import { payingAccountOptions } from '../../../common/form/controllers/scheduleFields.js';
import { monthName } from '../../../common/dates.js';
import { FREQUENCY_OPTIONS } from '../../../providers/common/providerLabels.js';
import {
  DESCRIPTION_MAX_LENGTH, KIND_OPTIONS, NOTES_MAX_LENGTH, providerOptions,
} from '../controllers/billFormFields.js';

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => [String(index + 1), monthName(index + 1)]);

/** Hint of the Show in calendar checkbox of a recurring bill. */
export const SHOW_IN_CALENDAR_HINT = 'Untick to stop this bill. Its payment history is kept.';

/** Body of the Delete bill confirmation. */
export const DELETE_BILL_BODY = 'Delete this bill? This cannot be undone.';

/**
 * Render the kind select (locked on the edit page) and the provider select (locked on a
 * recurring bill's edit page, since its provider can't change).
 *
 * @param {object} state - Form state.
 * @param {{onFieldChange: Function}} handlers - Field handlers.
 * @returns {React.ReactElement} The selects.
 */
function renderKindAndProvider(state, { onFieldChange }) {
  const locked = Boolean(state.edit);

  return (
    <>
      <AccountFormSelect name="kind" label="Kind" options={KIND_OPTIONS} state={state} onChange={onFieldChange} disabled={locked} />
      <AccountFormSelect
        name="provider_account_id"
        label="Provider"
        options={providerOptions(state.providers)}
        placeholder="Choose…"
        state={state}
        onChange={onFieldChange}
        disabled={locked && state.fields.kind === 'recurring'}
      />
    </>
  );
}

/**
 * Render the amount, description and notes inputs shared by both kinds, in the order given by
 * `name`.
 *
 * @param {string} name - `expected_amount`, `description` or `notes`.
 * @param {object} state - Form state.
 * @param {Function} onChange - Change handler.
 * @returns {React.ReactElement} The input.
 */
function renderCommonInput(name, state, onChange) {
  const inputs = new Map([
    ['expected_amount', { label: 'Amount', extra: { inputMode: 'decimal' } }],
    ['description', { label: 'Description', extra: { maxLength: DESCRIPTION_MAX_LENGTH } }],
    ['notes', { label: 'Notes', type: 'textarea', extra: { maxLength: NOTES_MAX_LENGTH } }],
  ]);

  return <AccountFormInput name={name} {...inputs.get(name)} state={state} onChange={onChange} />;
}

/**
 * Render the fields of a one-off bill: paying account (in the provider's currency), due date,
 * amount, description and notes.
 *
 * @param {object} state - Form state.
 * @param {Function} onChange - Change handler.
 * @returns {React.ReactElement} The fields.
 */
function renderOneOffFields(state, onChange) {
  return (
    <>
      <AccountFormSelect
        name="paying_account_id"
        label="Paying account"
        options={payingAccountOptions(state.accounts, state.currency)}
        placeholder="Choose…"
        state={state}
        onChange={onChange}
      />
      <AccountFormInput name="due_date" label="Due date" type="date" state={state} onChange={onChange} />
      {renderCommonInput('expected_amount', state, onChange)}
      {renderCommonInput('description', state, onChange)}
      {renderCommonInput('notes', state, onChange)}
    </>
  );
}

/**
 * Render the due month select, shown only for a yearly frequency.
 *
 * @param {object} state - Form state.
 * @param {Function} onChange - Change handler.
 * @returns {React.ReactElement|null} The select, or `null` for a monthly frequency.
 */
function renderDueMonth(state, onChange) {
  if (state.fields.charge_frequency !== 'yearly') {
    return null;
  }

  return <AccountFormSelect name="due_month" label="Due month" options={MONTH_OPTIONS} placeholder="Choose…" state={state} onChange={onChange} />;
}

/**
 * Render the fields of a recurring bill: description, expected amount, frequency, due day, due
 * month (yearly only), Bills from, Show in calendar and the default paying account.
 *
 * @param {object} state - Form state.
 * @param {Function} onChange - Change handler.
 * @returns {React.ReactElement} The fields.
 */
function renderRecurringFields(state, onChange) {
  return (
    <>
      {renderCommonInput('description', state, onChange)}
      {renderCommonInput('expected_amount', state, onChange)}
      <AccountFormSelect name="charge_frequency" label="Frequency" options={FREQUENCY_OPTIONS} state={state} onChange={onChange} />
      <AccountFormInput name="due_day" label="Due day" extra={{ inputMode: 'numeric' }} state={state} onChange={onChange} />
      {renderDueMonth(state, onChange)}
      <AccountFormInput name="bills_from" label="Bills from" type="date" state={state} onChange={onChange} />
      <AccountFormCheckbox name="show_in_calendar" label="Show in calendar" hint={SHOW_IN_CALENDAR_HINT} state={state} onChange={onChange} />
      <AccountFormSelect
        name="paying_account_id"
        label="Default paying account"
        options={payingAccountOptions(state.accounts, state.currency)}
        placeholder="None"
        state={state}
        onChange={onChange}
      />
      {renderCommonInput('notes', state, onChange)}
    </>
  );
}

/**
 * Render the bill's fields: the kind and provider selects, then the fields of the kind.
 *
 * @param {object} state - Form state.
 * @param {{onFieldChange: Function}} handlers - Field handlers.
 * @returns {React.ReactElement} The fields.
 */
function renderFields(state, handlers) {
  const recurring = state.fields.kind === 'recurring';

  return (
    <>
      {renderKindAndProvider(state, handlers)}
      {recurring ? renderRecurringFields(state, handlers.onFieldChange) : renderOneOffFields(state, handlers.onFieldChange)}
    </>
  );
}

/**
 * Render the Delete button and its confirmation, on the edit page only.
 *
 * @param {object} state - Form state (`canDelete`, `confirming`, `pending`).
 * @param {object} handlers - `onDelete`, `onConfirmDelete`, `onCancelDelete`.
 * @returns {React.ReactElement|null} The button and modal, or `null` on the new page.
 */
function renderDelete(state, handlers) {
  if (!state.canDelete) {
    return null;
  }

  return (
    <>
      <Button variant="outline-danger" className="ms-2" onClick={handlers.onDelete} disabled={state.pending}>Delete</Button>
      <ConfirmModal
        show={Boolean(state.confirming)}
        title="Delete bill"
        pending={state.pending}
        onConfirm={handlers.onConfirmDelete}
        onCancel={handlers.onCancelDelete}
      >
        {DELETE_BILL_BODY}
      </ConfirmModal>
    </>
  );
}

/**
 * Render the form, or a loading notice until the data is known.
 *
 * @param {object} state - Form state.
 * @param {object} handlers - Event handlers.
 * @param {{submitLabel: string, cancelHref: string}} options - Submit label and cancel link.
 * @returns {React.ReactElement|null} The form.
 */
function renderForm(state, handlers, options) {
  if (!state.fields) {
    return state.loadError ? null : <p className="text-muted">Loading…</p>;
  }

  return (
    <form onSubmit={handlers.onSubmit} noValidate>
      <BankErrorAlert error={state.submitError} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
      {renderFields(state, handlers)}
      <button type="submit" className="btn btn-primary me-2" disabled={state.pending}>{options.submitLabel}</button>
      <a className="btn btn-outline-secondary" href={options.cancelHref}>Cancel</a>
      {renderDelete(state, handlers)}
    </form>
  );
}

/**
 * Rendering helper of the provider bill pages (create and edit, one-off and recurring).
 */
const BankBillFormHelper = {
  /**
   * Render a bill form page: heading, load alert and the form (with Delete on the edit page).
   * Every value is rendered as escaped text.
   *
   * @param {{fields: (object|null), fieldErrors: object, submitError: (object|null),
   *   loadError: (object|null), pending: boolean, providers: (Array<object>|null),
   *   accounts: (Array<object>|null), currency: string, confirming: boolean,
   *   canDelete: boolean, edit: boolean, idPrefix: string}} state - Form state.
   * @param {{onSubmit: Function, onFieldChange: Function, onRetry: Function,
   *   onDismiss: Function, onRetryLoad: Function, onDelete: Function,
   *   onConfirmDelete: Function, onCancelDelete: Function}} handlers - Event handlers.
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

export default BankBillFormHelper;
