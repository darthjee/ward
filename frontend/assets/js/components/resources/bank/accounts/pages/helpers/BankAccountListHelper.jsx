import Table from 'react-bootstrap/cjs/Table.js';
import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import { formatMoney } from '../../../common/amounts.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { withHashQuery } from '../../../../../../utils/routing/hashQuery.js';

const LIST_PATH = '/bank/accounts';

/**
 * Render the "Archived" badge of an archived account.
 *
 * @param {object} account - The account.
 * @returns {React.ReactElement|null} The badge, or `null` for an active account.
 */
function renderArchivedBadge(account) {
  if (!account.archived_at) {
    return null;
  }

  return <span className="badge text-bg-secondary ms-2">Archived</span>;
}

/**
 * Render one account row; the whole row links to the detail page.
 *
 * @param {object} account - The account.
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The row.
 */
function renderRow(account, context) {
  return (
    <tr key={account.id} className={`position-relative${account.archived_at ? ' text-muted' : ''}`}>
      <td className="text-break">
        <a className="stretched-link" href={contextHash(context, `${LIST_PATH}/${account.id}`)}>{account.name}</a>
        {renderArchivedBadge(account)}
      </td>
      <td className="text-break">{account.bank_name}</td>
      <td className="text-break">{account.branch}</td>
      <td>{account.account_number}</td>
      <td>{account.currency}</td>
      <td className="text-end text-nowrap">{formatMoney(account.balance, account.currency)}</td>
    </tr>
  );
}

/**
 * Render the accounts table, or the empty state.
 *
 * @param {Array<object>} accounts - The accounts, sorted by name.
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The table or the empty state.
 */
function renderAccounts(accounts, context) {
  if (accounts.length === 0) {
    return (
      <div className="text-center text-muted my-5">
        <p>No accounts yet</p>
        <a className="btn btn-primary" href={contextHash(context, `${LIST_PATH}/new`)}>Create an account</a>
      </div>
    );
  }

  return (
    <Table hover responsive>
      <thead>
        <tr>
          <th>Name</th>
          <th>Bank</th>
          <th>Branch</th>
          <th>Account number</th>
          <th>Currency</th>
          <th className="text-end">Balance</th>
        </tr>
      </thead>
      <tbody>{accounts.map((account) => renderRow(account, context))}</tbody>
    </Table>
  );
}

/**
 * Render the body: the accounts once loaded, a loading notice otherwise.
 *
 * @param {{accounts: (Array<object>|null), context: object}} state - Page state.
 * @returns {React.ReactElement|null} The body.
 */
function renderBody({ accounts, error, context }) {
  if (accounts) {
    return renderAccounts(accounts, context);
  }

  return error ? null : <p className="text-muted">Loading…</p>;
}

/**
 * Rendering helper for the Accounts list page.
 */
const BankAccountListHelper = {
  /**
   * Render the Accounts list: the header with the *Show archived* toggle and **New account**,
   * the error alert and the accounts table (no grand total, since currencies may differ).
   *
   * @param {{accounts: (Array<object>|null), error: (object|null), archived: boolean,
   *   context: object}} state - The loaded accounts, the classified error, the archived filter
   *   and the active owner context.
   * @param {{onRetry: Function, onDismiss: Function}} handlers - Alert handlers.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    const listHash = contextHash(state.context, LIST_PATH);
    const toggleHash = withHashQuery(listHash, { archived: state.archived ? null : 'true' });

    return (
      <div className="container mt-4">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <h1 className="me-auto mb-0">Accounts</h1>
          <a className="btn btn-outline-secondary" href={toggleHash}>
            {state.archived ? 'Hide archived' : 'Show archived'}
          </a>
          <a className="btn btn-primary" href={contextHash(state.context, `${LIST_PATH}/new`)}>New account</a>
        </div>
        <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
        {renderBody(state)}
      </div>
    );
  },
};

export default BankAccountListHelper;
