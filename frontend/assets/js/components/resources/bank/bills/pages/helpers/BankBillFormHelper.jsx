import Button from 'react-bootstrap/cjs/Button.js';
import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import ConfirmModal from '../../../common/ConfirmModal.jsx';
import AccountFormInput from '../../../common/form/AccountFormInput.jsx';
import AccountFormSelect from '../../../common/form/AccountFormSelect.jsx';
import { payingAccountOptions } from '../../../common/form/controllers/scheduleFields.js';
import { DESCRIPTION_MAX_LENGTH, NOTES_MAX_LENGTH, providerOptions } from '../controllers/billFormFields.js';

/** Body of the Delete bill confirmation. */
export const DELETE_BILL_BODY = 'Delete this bill? This cannot be undone.';

/**
 * Render the bill's fields: provider, paying account (in the provider's currency), due date,
 * amount, description and notes.
 *
 * @param {object} state - Form state.
 * @param {{onFieldChange: Function}} handlers - Field handlers.
 * @returns {React.ReactElement} The fields.
 */
function renderFields(state, { onFieldChange }) {
  return (
    <>
      <AccountFormSelect
        name="provider_account_id"
        label="Provider"
        options={providerOptions(state.providers)}
        placeholder="Choose…"
        state={state}
        onChange={onFieldChange}
      />
      <AccountFormSelect
        name="paying_account_id"
        label="Paying account"
        options={payingAccountOptions(state.accounts, state.currency)}
        placeholder="Choose…"
        state={state}
        onChange={onFieldChange}
      />
      <AccountFormInput name="due_date" label="Due date" type="date" state={state} onChange={onFieldChange} />
      <AccountFormInput name="amount" label="Amount" extra={{ inputMode: 'decimal' }} state={state} onChange={onFieldChange} />
      <AccountFormInput
        name="description"
        label="Description"
        extra={{ maxLength: DESCRIPTION_MAX_LENGTH }}
        state={state}
        onChange={onFieldChange}
      />
      <AccountFormInput
        name="notes"
        label="Notes"
        type="textarea"
        extra={{ maxLength: NOTES_MAX_LENGTH }}
        state={state}
        onChange={onFieldChange}
      />
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
 * Rendering helper of the one-off bill pages (create and edit).
 */
const BankBillFormHelper = {
  /**
   * Render a bill form page: heading, load alert and the form (with Delete on the edit page).
   * Every value is rendered as escaped text.
   *
   * @param {{fields: (object|null), fieldErrors: object, submitError: (object|null),
   *   loadError: (object|null), pending: boolean, providers: (Array<object>|null),
   *   accounts: (Array<object>|null), currency: string, confirming: boolean,
   *   canDelete: boolean, idPrefix: string}} state - Form state.
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
