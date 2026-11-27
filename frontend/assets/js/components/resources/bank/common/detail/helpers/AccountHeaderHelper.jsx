import Button from 'react-bootstrap/cjs/Button.js';
import { formatMoney } from '../../amounts.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';

/** Banner shown on an archived account. */
export const ARCHIVED_BANNER = 'This account is archived: it is read-only. You can only unarchive or rename it.';

/**
 * Render the Edit (Rename when archived) link, offered only to a role that manages accounts.
 *
 * @param {object} state - Header state (`account`, `context`, `base`, `canManageAccounts`).
 * @param {boolean} archived - Whether the account is archived.
 * @returns {React.ReactElement|null} The link, or `null`.
 */
function renderEditLink(state, archived) {
  if (!state.canManageAccounts) {
    return null;
  }

  const href = contextHash(state.context, `${state.base}/${state.account.id}/edit`);

  return (
    <a className="btn btn-outline-primary" href={href}>
      {archived ? 'Rename' : 'Edit'}
    </a>
  );
}

/**
 * Render the Archive or Unarchive button, offered only to a role that manages accounts.
 *
 * @param {boolean} allowed - Whether the caller's role manages accounts.
 * @param {boolean} archived - Whether the account is archived.
 * @param {boolean} busy - Whether an action is in flight.
 * @param {object} handlers - `onArchive` / `onUnarchive`.
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderArchiveButton(allowed, archived, busy, handlers) {
  if (!allowed) {
    return null;
  }

  if (archived) {
    return <Button variant="outline-secondary" onClick={handlers.onUnarchive} disabled={busy}>Unarchive</Button>;
  }

  return <Button variant="outline-secondary" onClick={handlers.onArchive} disabled={busy}>Archive</Button>;
}

/**
 * Render the Delete button, offered only for an active account without transactions, to a
 * role that may delete.
 *
 * @param {boolean} deletable - Whether the account may be deleted (state and role).
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
 * Render the Reconcile / Continue reconciliation button, offered on an active account to a
 * role that may write.
 *
 * @param {{account: object, reconcile: ({canWrite: boolean}|undefined)}} state - Header state.
 * @param {{reconcile: ({onReconcile: Function}|undefined)}} handlers - Action handlers.
 * @returns {React.ReactElement|null} The button, or `null`.
 */
function renderReconcileButton({ account, reconcile }, handlers) {
  if (account.archived_at || !reconcile?.canWrite) {
    return null;
  }

  return (
    <Button variant="outline-primary" onClick={handlers.reconcile.onReconcile} disabled={reconcile.pending}>
      {account.open_reconciliation_id ? 'Continue reconciliation' : 'Reconcile'}
    </Button>
  );
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
   * archived) linking to `<base>/:id/edit` and Archive / Unarchive when the role manages
   * accounts, and Delete only when the account is active, has no transactions and the role may
   * delete —, the current balance, then the section's own details block.
   *
   * @param {{account: object, hasTransactions: boolean, actionPending: (string|null),
   *   context: object, base: string, details: React.ReactNode, canManageAccounts: boolean,
   *   canDelete: boolean, reconcile: object}} state - The account, the "has transactions" signal, the in-flight
   *   action, the owner context, the section base path, the details block (e.g. the regular
   *   `<dl>`, or the debt info block) and the caller's permissions.
   * @param {{onArchive: Function, onUnarchive: Function, onDeleteAccount: Function,
   *   reconcile: object}} handlers - Action handlers (`reconcile.onReconcile` opens the
   *   reconcile mode).
   * @returns {React.ReactElement} The rendered header.
   */
  render(state, handlers) {
    const {
      account, hasTransactions, actionPending, details, canManageAccounts, canDelete,
    } = state;
    const archived = Boolean(account.archived_at);
    const busy = Boolean(actionPending);

    return (
      <>
        {renderBanner(archived)}
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <h1 className="me-auto mb-0 text-break">{account.name}</h1>
          {renderReconcileButton(state, handlers)}
          {renderEditLink(state, archived)}
          {renderArchiveButton(Boolean(canManageAccounts), archived, busy, handlers)}
          {renderDeleteButton(Boolean(canDelete) && !archived && !hasTransactions, busy, handlers.onDeleteAccount)}
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
