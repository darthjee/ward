import Button from 'react-bootstrap/cjs/Button.js';
import { formatMoney } from '../../amounts.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';

/** Banner shown on an archived account. */
export const ARCHIVED_BANNER = 'This account is archived: it is read-only. You can only unarchive or rename it.';

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
 * Rendering helper for the header shared by every account detail page (Accounts, Debts).
 */
const AccountHeaderHelper = {
  /**
   * Render the account header: the archived banner, the name, the actions — Edit (Rename when
   * archived) linking to `<base>/:id/edit`, Archive / Unarchive, and Delete only when the
   * account is active and has no transactions —, the current balance, then the section's own
   * details block.
   *
   * @param {{account: object, hasTransactions: boolean, actionPending: (string|null),
   *   context: object, base: string, details: React.ReactNode}} state - The account, the "has
   *   transactions" signal, the in-flight action, the owner context, the section base path and
   *   the details block (e.g. the regular `<dl>`, or the debt info block).
   * @param {{onArchive: Function, onUnarchive: Function, onDeleteAccount: Function}} handlers -
   *   Action handlers.
   * @returns {React.ReactElement} The rendered header.
   */
  render({
    account, hasTransactions, actionPending, context, base, details,
  }, handlers) {
    const archived = Boolean(account.archived_at);
    const busy = Boolean(actionPending);

    return (
      <>
        {renderBanner(archived)}
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <h1 className="me-auto mb-0 text-break">{account.name}</h1>
          <a className="btn btn-outline-primary" href={contextHash(context, `${base}/${account.id}/edit`)}>
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
        {details}
      </>
    );
  },
};

export default AccountHeaderHelper;
