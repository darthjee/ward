import AccountDetailHelper from '../../../common/detail/helpers/AccountDetailHelper.jsx';
import AccountHeaderHelper from '../../../common/detail/helpers/AccountHeaderHelper.jsx';
import ProviderInfoHelper from './ProviderInfoHelper.jsx';
import ProviderShortcuts from '../../common/ProviderShortcuts.jsx';
import SentMark from '../../common/SentMark.jsx';
import BillHistory from '../../../common/bills/BillHistory.jsx';
import { PROVIDERS_BASE } from '../../../common/sections.js';

/**
 * Render the provider header: the shared header under the Providers section, with the
 * provider details.
 *
 * @param {object} header - Header state (`account`, `hasTransactions`, `actionPending`,
 *   `context`).
 * @param {object} handlers - Action handlers.
 * @returns {React.ReactElement} The header.
 */
function renderHeader(header, handlers) {
  return AccountHeaderHelper.render({
    ...header, base: PROVIDERS_BASE, details: ProviderInfoHelper.render(header.account),
  }, handlers);
}

/**
 * Render the Add charge / Add payment shortcuts.
 *
 * @param {object} account - The provider account.
 * @param {{onStartNew: Function}} handlers - Page handlers.
 * @returns {React.ReactElement} The shortcuts.
 */
function renderShortcuts(account, handlers) {
  return <ProviderShortcuts account={account} onStartNew={handlers.onStartNew} />;
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
 * Render the provider's Bill history after the ledger; an undo reloads the provider and its
 * ledger.
 *
 * @param {object} account - The provider account.
 * @param {{onRetryLoad: Function}} handlers - Page handlers.
 * @param {{context: object}} state - Page state.
 * @returns {React.ReactElement} The Bill history.
 */
function renderAfterLedger(account, handlers, state) {
  return (
    <BillHistory context={state.context} account={account} sourceType="provider_expense" onUndone={handlers.onRetryLoad} />
  );
}

/**
 * Rendering helper composing the provider detail page.
 */
const BankProviderDetailHelper = {
  /**
   * Render the provider detail page: the shared detail page under the Providers section, with
   * the provider header (info block), the Add charge / Add payment shortcuts above the ledger
   * and each sent charge's mark with **Mark as unsent** (also on an archived provider), and the
   * Bill history after the ledger.
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
      renderAfterLedger,
    });
  },
};

export default BankProviderDetailHelper;
