import AccountDetailHelper from '../../../common/detail/helpers/AccountDetailHelper.jsx';
import AccountHeaderHelper from '../../../common/detail/helpers/AccountHeaderHelper.jsx';
import ProviderInfoHelper from './ProviderInfoHelper.jsx';
import ProviderShortcuts from '../../common/ProviderShortcuts.jsx';
import AddBillLink from '../../common/AddBillLink.jsx';
import SentMark from '../../common/SentMark.jsx';
import ProviderBills from '../../common/ProviderBills.jsx';
import { PROVIDERS_BASE } from '../../../common/sections.js';

/**
 * Render the provider header: the shared header under the Providers section, with the
 * provider details.
 *
 * @param {object} header - Header state (`account`, `hasTransactions`, `actionPending`,
 *   `context`, `canManageAccounts`, `canDelete`).
 * @param {object} handlers - Action handlers.
 * @returns {React.ReactElement} The header.
 */
function renderHeader(header, handlers) {
  return AccountHeaderHelper.render({
    ...header, base: PROVIDERS_BASE, details: ProviderInfoHelper.render(header.account),
  }, handlers);
}

/**
 * Render the Add charge / Add payment shortcuts and the Add bill link.
 *
 * @param {object} account - The provider account.
 * @param {{onStartNew: Function}} handlers - Page handlers.
 * @param {{context: object}} state - Page state.
 * @returns {React.ReactElement} The shortcuts.
 */
function renderShortcuts(account, handlers, state) {
  return (
    <ProviderShortcuts context={state.context} account={account} onStartNew={handlers.onStartNew}>
      <AddBillLink account={account} context={state.context} />
    </ProviderShortcuts>
  );
}

/**
 * Render the provider's Bills block, below the provider info.
 *
 * @param {object} account - The provider account.
 * @param {object} handlers - Page handlers.
 * @param {{context: object}} state - Page state.
 * @returns {React.ReactElement} The Bills block.
 */
function renderAfterHeader(account, handlers, state) {
  return <ProviderBills context={state.context} account={account} />;
}

/**
 * Render a ledger row's sent mark (charges carrying `sent_to_accountant_at` only).
 *
 * @param {object} transaction - The ledger row.
 * @param {{onMarkUnsent: Function}} handlers - Page handlers (with Mark as unsent).
 * @param {{markUnsentPending: boolean}} state - Page state.
 * @returns {React.ReactElement} The sent mark.
 */
function renderRowExtra(transaction, handlers, state) {
  return (
    <SentMark
      transaction={transaction}
      pending={Boolean(state.markUnsentPending)}
      onMarkUnsent={handlers.onMarkUnsent}
    />
  );
}

/**
 * Rendering helper composing the provider detail page.
 */
const BankProviderDetailHelper = {
  /**
   * Render the provider detail page: the shared detail page under the Providers section, with
   * the provider header (info block), the Add charge / Add payment shortcuts and the Add bill
   * link above the ledger
   * and each sent charge's mark with **Mark as unsent** (also on an archived provider). The
   * Bills block (with a History link per bill) sits below the provider info.
   *
   * @param {{context: object, accountId: (number|string), page: number,
   *   data: ({account: object, ledger: object}|null), loadError: (object|null),
   *   error: (object|null), form: object, actionPending: (string|null),
   *   confirmation: (object|null), markUnsentPending: boolean}} state - Page state, with the
   *   Mark as unsent in-flight flag.
   * @param {object} handlers - Page handlers (see `buildDetailHandlers`) and `onMarkUnsent`.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    return AccountDetailHelper.render(state, handlers, {
      base: PROVIDERS_BASE, backLabel: 'Providers', renderHeader, renderShortcuts, renderRowExtra,
      renderAfterHeader,
    });
  },
};

export default BankProviderDetailHelper;
