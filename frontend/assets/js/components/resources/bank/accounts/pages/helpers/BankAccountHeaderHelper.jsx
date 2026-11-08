import Button from 'react-bootstrap/cjs/Button.js';
import { formatMoney } from '../../../common/amounts.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';

/** Banner shown on an archived account. */
export const ARCHIVED_BANNER = 'This account is archived: it is read-only. You can only unarchive or rename it.';

/**
 * Render one definition-list entry.
 *
 * @param {string} label - The term.
 * @param {React.ReactNode} value - The description (`—` when blank).
 * @returns {React.ReactElement} The entry.
 */
function renderEntry(label, value) {
  return (
    <div className="col-sm-6 col-lg-4 mb-2" key={label}>
      <dt className="small text-muted">{label}</dt>
      <dd className="mb-0 text-break" style={{ whiteSpace: 'pre-wrap' }}>{value || '—'}</dd>
    </div>
  );
}

/**
 * Render the Archive or Unarchive button.
 *
 * @param {boolean} archived - Whether the account is archived.
 * @param {boolean} busy - Whether an action is in flight.
 * @param {object} handlers - `onArchive` / `onUnarchive`.
 * @returns {React.ReactElement} The button.
 */
function renderArchiveButton(archived, busy, handlers) {
  if (archived) {
    return <Button variant="outline-secondary" onClick={handlers.onUnarchive} disabled={busy}>Unarchive</Button>;
  }

  return <Button variant="outline-secondary" onClick={handlers.onArchive} disabled={busy}>Archive</Button>;
}

/**
 * Render the Delete button, offered only for an active account without transactions.
 *
 * @param {boolean} deletable - Whether the account may be deleted.
 * @param {boolean} busy - Whether an action is in flight.
 * @param {Function} onDelete - Opens the delete confirmation.
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderDeleteButton(deletable, busy, onDelete) {
  if (!deletable) {
    return null;
  }

  return <Button variant="outline-danger" onClick={onDelete} disabled={busy}>Delete</Button>;
}

/**
 * Render the archived banner.
 *
 * @param {boolean} archived - Whether the account is archived.
 * @returns {React.ReactElement|null} The banner, or `null`.
 */
function renderBanner(archived) {
  return archived ? <div className="alert alert-secondary">{ARCHIVED_BANNER}</div> : null;
}

/**
 * Rendering helper for the account detail header.
 */
const BankAccountHeaderHelper = {
  /**
   * Render the account header: every field (full account number), the current balance and the
   * actions — Edit (Rename when archived), Archive / Unarchive, and Delete only when the account
   * is active and has no transactions.
   *
   * @param {{account: object, hasTransactions: boolean, actionPending: (string|null),
   *   context: object}} state - The account, the "has transactions" signal, the in-flight
   *   action and the owner context.
   * @param {{onArchive: Function, onUnarchive: Function, onDeleteAccount: Function}} handlers -
   *   Action handlers.
   * @returns {React.ReactElement} The rendered header.
   */
  render({
    account, hasTransactions, actionPending, context,
  }, handlers) {
    const archived = Boolean(account.archived_at);
    const busy = Boolean(actionPending);

    return (
      <>
        {renderBanner(archived)}
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <h1 className="me-auto mb-0 text-break">{account.name}</h1>
          <a className="btn btn-outline-primary" href={contextHash(context, `/bank/accounts/${account.id}/edit`)}>
            {archived ? 'Rename' : 'Edit'}
          </a>
          {renderArchiveButton(archived, busy, handlers)}
          {renderDeleteButton(!archived && !hasTransactions, busy, handlers.onDeleteAccount)}
        </div>
        <p className="fs-4">
          Balance:
          {' '}
          <strong>{formatMoney(account.balance, account.currency)}</strong>
        </p>
        <dl className="row">
          {renderEntry('Bank', account.bank_name)}
          {renderEntry('Branch', account.branch)}
          {renderEntry('Account number', account.account_number)}
          {renderEntry('Currency', account.currency)}
          {renderEntry('Opening date', account.opening_date)}
          {renderEntry('Opening balance', formatMoney(account.opening_balance, account.currency))}
          {renderEntry('Notes', account.notes)}
        </dl>
      </>
    );
  },
};

export default BankAccountHeaderHelper;
