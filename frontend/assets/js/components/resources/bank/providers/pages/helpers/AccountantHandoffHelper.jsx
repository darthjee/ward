import Button from 'react-bootstrap/cjs/Button.js';
import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import ConfirmModal from '../../../common/ConfirmModal.jsx';
import { PROVIDERS_BASE } from '../../../common/sections.js';
import { chargeCount } from '../../common/chargeTotals.js';
import AccountantPreviewHelper from './AccountantPreviewHelper.jsx';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';

const ID_PREFIX = 'accountant-';

/**
 * Render the inline range validation message.
 *
 * @param {string|null} message - The client-side range error.
 * @returns {React.ReactElement|null} The message, or `null` for a valid range.
 */
function renderRangeError(message) {
  if (!message) {
    return null;
  }

  return <div className="text-danger small w-100" role="alert">{message}</div>;
}

/**
 * Render one date input of the range.
 *
 * @param {string} name - `from` or `to`.
 * @param {string} label - The label.
 * @param {object} state - Page state.
 * @param {Function} onChange - Change handler.
 * @returns {React.ReactElement} The input.
 */
function renderDate(name, label, state, onChange) {
  const id = `${ID_PREFIX}${name}`;
  const value = name === 'from' ? state.from : state.to;

  return (
    <div>
      <label className="form-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type="date"
        className={`form-control${state.rangeError ? ' is-invalid' : ''}`}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

/**
 * Render the range inputs and the "Unsent only" toggle.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement} The filters.
 */
function renderFilters(state, handlers) {
  return (
    <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
      {renderDate('from', 'From', state, handlers.onRangeChange)}
      {renderDate('to', 'To', state, handlers.onRangeChange)}
      <div className="form-check mb-2">
        <input
          id={`${ID_PREFIX}unsent-only`}
          type="checkbox"
          className="form-check-input"
          checked={state.unsentOnly}
          onChange={handlers.onUnsentOnlyChange}
        />
        <label className="form-check-label" htmlFor={`${ID_PREFIX}unsent-only`}>Unsent only</label>
      </div>
      {renderRangeError(state.rangeError)}
    </div>
  );
}

/**
 * Render the success alert shown after Mark as sent.
 *
 * @param {string|null} success - The success message.
 * @param {Function} onDismiss - Dismisses the alert.
 * @returns {React.ReactElement|null} The alert, or `null`.
 */
function renderSuccess(success, onDismiss) {
  if (!success) {
    return null;
  }

  return (
    <div className="alert alert-success alert-dismissible" role="status">
      {success}
      <button type="button" className="btn-close" aria-label="Close" onClick={onDismiss} />
    </div>
  );
}

/**
 * Render the Download CSV and Mark as sent buttons. Both act on the loaded rows and are
 * disabled while a load is in flight; Mark as sent also needs rows and no mark in flight.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement} The actions.
 */
function renderActions(state, handlers) {
  const loaded = Boolean(state.charges) && !state.loading;

  return (
    <div className="d-flex flex-wrap gap-2 mb-3">
      <Button variant="outline-primary" onClick={handlers.onDownload} disabled={!loaded}>Download CSV</Button>
      <Button
        variant="primary"
        onClick={handlers.onMarkSent}
        disabled={!loaded || state.marking || state.charges.length === 0}
      >
        Mark as sent
      </Button>
    </div>
  );
}

/**
 * Render the Mark as sent confirmation.
 *
 * @param {object} state - Page state.
 * @param {object} handlers - Page handlers.
 * @returns {React.ReactElement} The modal.
 */
function renderConfirm(state, handlers) {
  return (
    <ConfirmModal
      show={state.confirming}
      title="Mark as sent"
      confirmLabel="Mark as sent"
      pending={state.marking}
      onConfirm={handlers.onConfirmMarkSent}
      onCancel={handlers.onCancelMarkSent}
    >
      {`Mark ${chargeCount(state.charges?.length ?? 0)} as sent?`}
    </ConfirmModal>
  );
}

/**
 * Rendering helper for the accountant hand-off page.
 */
const AccountantHandoffHelper = {
  /**
   * Render the hand-off page: the back link to Providers, the range and "Unsent only" toggle,
   * the page and success alerts, Download CSV / Mark as sent, the preview with its
   * per-currency totals and the Mark as sent confirmation.
   *
   * @param {{context: object, from: string, to: string, unsentOnly: boolean,
   *   rangeError: (string|null), charges: (Array<object>|null), loading: boolean,
   *   error: (object|null), confirming: boolean, marking: boolean,
   *   success: (string|null)}} state - Page state.
   * @param {object} handlers - Page handlers (see `useAccountantHandoff`).
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <p className="mb-2">
          <a href={contextHash(state.context, PROVIDERS_BASE)}>← Providers</a>
        </p>
        <h1>Accountant hand-off</h1>
        {renderFilters(state, handlers)}
        <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
        {renderSuccess(state.success, handlers.onDismissSuccess)}
        {renderActions(state, handlers)}
        {AccountantPreviewHelper.render(state)}
        {renderConfirm(state, handlers)}
      </div>
    );
  },
};

export default AccountantHandoffHelper;
