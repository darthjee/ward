import AccountDetailHelper from '../../../common/detail/helpers/AccountDetailHelper.jsx';
import AccountHeaderHelper from '../../../common/detail/helpers/AccountHeaderHelper.jsx';
import InvestmentInfoHelper from './InvestmentInfoHelper.jsx';
import InvestmentShortcuts from '../../common/InvestmentShortcuts.jsx';
import { initialUpdateValue } from '../../common/controllers/UpdateValueController.js';
import { INVESTMENTS_BASE } from '../../../common/sections.js';

/**
 * Render the investment header: the shared header under the Investments section, with the
 * investment details.
 *
 * @param {object} header - Header state (`account`, `hasTransactions`, `actionPending`,
 *   `context`).
 * @param {object} handlers - Action handlers.
 * @returns {React.ReactElement} The header.
 */
function renderHeader(header, handlers) {
  return AccountHeaderHelper.render({
    ...header, base: INVESTMENTS_BASE, details: InvestmentInfoHelper.render(header.account),
  }, handlers);
}

/**
 * Render the Add application / Add withdrawal shortcuts and the Update value form.
 *
 * @param {object} account - The investment account.
 * @param {object} handlers - Page handlers (with the Update value handlers).
 * @param {{updateValue: object}} state - Page state (with the Update value form state).
 * @returns {React.ReactElement} The shortcuts.
 */
function renderShortcuts(account, handlers, state) {
  return (
    <InvestmentShortcuts
      account={account}
      onStartNew={handlers.onStartNew}
      updateValue={state.updateValue ?? initialUpdateValue()}
      handlers={handlers}
    />
  );
}

/**
 * Rendering helper composing the investment detail page.
 */
const BankInvestmentDetailHelper = {
  /**
   * Render the investment detail page: the shared detail page under the Investments section,
   * with the investment header (info block) and the Add application / Add withdrawal / Update
   * value shortcuts above the ledger.
   *
   * @param {{context: object, accountId: (number|string), page: number,
   *   data: ({account: object, ledger: object}|null), loadError: (object|null),
   *   error: (object|null), form: object, actionPending: (string|null),
   *   confirmation: (object|null), updateValue: object}} state - Page state, with the Update
   *   value form state.
   * @param {object} handlers - Page handlers (see `buildDetailHandlers`) and the Update value
   *   handlers (see `useUpdateValueForm`).
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    return AccountDetailHelper.render(state, handlers, {
      base: INVESTMENTS_BASE, backLabel: 'Investments', renderHeader, renderShortcuts,
    });
  },
};

export default BankInvestmentDetailHelper;
