import Table from 'react-bootstrap/cjs/Table.js';
import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import { formatMoney } from '../../../common/amounts.js';
import ArchivedBadge from '../../../common/list/ArchivedBadge.jsx';
import AccountListHeader from '../../../common/list/AccountListHeader.jsx';
import EmptyAccountList from '../../../common/list/EmptyAccountList.jsx';
import { PROVIDERS_BASE as LIST_PATH } from '../../../common/sections.js';
import { forAccountantLabel, formatExpected } from '../../common/providerLabels.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';

/**
 * Render one provider row; the whole row links to the provider detail page.
 *
 * @param {object} provider - The provider account (with its `provider_expense` object).
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The row.
 */
function renderRow(provider, context) {
  const details = provider.provider_expense ?? {};

  return (
    <tr key={provider.id} className={`position-relative${provider.archived_at ? ' text-muted' : ''}`}>
      <td className="text-break">
        <a className="stretched-link" href={contextHash(context, `${LIST_PATH}/${provider.id}`)}>{provider.name}</a>
        <ArchivedBadge account={provider} />
      </td>
      <td className="text-break">{provider.bank_name}</td>
      <td className="text-end text-nowrap">{formatMoney(provider.balance, provider.currency)}</td>
      <td className="text-end text-nowrap">
        {formatExpected(details.expected_amount, details.charge_frequency, provider.currency)}
      </td>
      <td>{forAccountantLabel(details.for_accountant)}</td>
      <td>{provider.currency}</td>
    </tr>
  );
}

/**
 * Render the providers table, or the empty state.
 *
 * @param {Array<object>} providers - The providers, sorted by name.
 * @param {object} context - The active owner context.
 * @returns {React.ReactElement} The table or the empty state.
 */
function renderProviders(providers, context) {
  if (providers.length === 0) {
    return (
      <EmptyAccountList
        message="No providers yet"
        href={contextHash(context, `${LIST_PATH}/new`)}
        label="Create a provider"
      />
    );
  }

  return (
    <Table hover responsive>
      <thead>
        <tr>
          <th>Name</th>
          <th>Provider</th>
          <th className="text-end">Balance</th>
          <th className="text-end">Expected amount</th>
          <th>For accountant</th>
          <th>Currency</th>
        </tr>
      </thead>
      <tbody>{providers.map((provider) => renderRow(provider, context))}</tbody>
    </Table>
  );
}

/**
 * Render the body: the providers once loaded, a loading notice otherwise.
 *
 * @param {{accounts: (Array<object>|null), error: (object|null), context: object}} state -
 *   Page state.
 * @returns {React.ReactElement|null} The body.
 */
function renderBody({ accounts, error, context }) {
  if (accounts) {
    return renderProviders(accounts, context);
  }

  return error ? null : <p className="text-muted">Loading…</p>;
}

/**
 * Rendering helper for the Providers list page.
 */
const BankProviderListHelper = {
  /**
   * Render the Providers list: the header with the *Show archived* toggle, the **Accountant
   * hand-off** link and **New provider**, the error alert and the providers table — name,
   * provider, current balance, expected amount with its frequency ("—" when unset),
   * for-accountant marker, currency (no total row, since currencies may differ).
   *
   * @param {{accounts: (Array<object>|null), error: (object|null), archived: boolean,
   *   context: object}} state - The loaded providers, the classified error, the archived
   *   filter and the active owner context.
   * @param {{onRetry: Function, onDismiss: Function}} handlers - Alert handlers.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    return (
      <div className="container mt-4">
        <AccountListHeader
          title="Providers"
          base={LIST_PATH}
          context={state.context}
          archived={state.archived}
          newLabel="New provider"
        >
          <a className="btn btn-outline-primary" href={contextHash(state.context, `${LIST_PATH}/accountant`)}>
            Accountant hand-off
          </a>
        </AccountListHeader>
        <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
        {renderBody(state)}
      </div>
    );
  },
};

export default BankProviderListHelper;
