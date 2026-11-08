import AccountDetailHelper from '../../../common/detail/helpers/AccountDetailHelper.jsx';
import BankAccountHeaderHelper from './BankAccountHeaderHelper.jsx';
import { ACCOUNTS_BASE } from '../../../common/sections.js';

/**
 * Render the regular account header.
 *
 * @param {object} header - Header state (`account`, `hasTransactions`, `actionPending`,
 *   `context`).
 * @param {object} handlers - Action handlers.
 * @returns {React.ReactElement} The header.
 */
function renderHeader(header, handlers) {
  return BankAccountHeaderHelper.render(header, handlers);
}

/**
 * Rendering helper composing the regular account detail page.
 */
const BankAccountDetailHelper = {
  /**
   * Render the regular account detail page: the shared detail page under the Accounts section,
   * with the regular header and no shortcuts.
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
      base: ACCOUNTS_BASE, backLabel: 'Accounts', renderHeader,
    });
  },
};

export default BankAccountDetailHelper;
