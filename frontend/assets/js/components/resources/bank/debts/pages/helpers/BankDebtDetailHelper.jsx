import AccountDetailHelper from '../../../common/detail/helpers/AccountDetailHelper.jsx';
import AccountHeaderHelper from '../../../common/detail/helpers/AccountHeaderHelper.jsx';
import DebtInfoHelper from './DebtInfoHelper.jsx';
import DebtShortcuts from '../../common/DebtShortcuts.jsx';
import { DEBTS_BASE } from '../../../common/sections.js';

/**
 * Render the debt header: the shared header under the Debts section, with the debt details.
 *
 * @param {object} header - Header state (`account`, `hasTransactions`, `actionPending`,
 *   `context`).
 * @param {object} handlers - Action handlers.
 * @returns {React.ReactElement} The header.
 */
function renderHeader(header, handlers) {
  return AccountHeaderHelper.render({
    ...header, base: DEBTS_BASE, details: DebtInfoHelper.render(header.account),
  }, handlers);
}

/**
 * Render the Add payment / Add interest shortcuts.
 *
 * @param {object} account - The debt account.
 * @param {{onStartNew: Function}} handlers - Page handlers.
 * @returns {React.ReactElement} The shortcuts.
 */
function renderShortcuts(account, handlers) {
  return <DebtShortcuts account={account} onStartNew={handlers.onStartNew} />;
}

/**
 * Rendering helper composing the debt detail page.
 */
const BankDebtDetailHelper = {
  /**
   * Render the debt detail page: the shared detail page under the Debts section, with the debt
   * header (info block) and the Add payment / Add interest shortcuts above the ledger.
   *
   * @param {{context: object, accountId: (number|string), page: number,
   *   data: ({account: object, ledger: object}|null), loadError: (object|null),
   *   error: (object|null), form: object, actionPending: (string|null),
   *   confirmation: (object|null)}} state - Page state.
   * @param {object} handlers - Page handlers (see `buildDetailHandlers`).
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    return AccountDetailHelper.render(state, handlers, {
      base: DEBTS_BASE, backLabel: 'Debts', renderHeader, renderShortcuts,
    });
  },
};

export default BankDebtDetailHelper;
