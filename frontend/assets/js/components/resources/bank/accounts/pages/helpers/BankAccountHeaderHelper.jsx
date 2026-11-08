import AccountHeaderHelper, { ARCHIVED_BANNER } from '../../../common/detail/helpers/AccountHeaderHelper.jsx';
import DetailEntry from '../../../common/detail/DetailEntry.jsx';
import { formatMoney } from '../../../common/amounts.js';
import { ACCOUNTS_BASE } from '../../../common/sections.js';

export { ARCHIVED_BANNER };

/**
 * Render the regular account's details: every field, with the full account number.
 *
 * @param {object} account - The account.
 * @returns {React.ReactElement} The definition list.
 */
function renderDetails(account) {
  return (
    <dl className="row">
      <DetailEntry label="Bank" value={account.bank_name} />
      <DetailEntry label="Branch" value={account.branch} />
      <DetailEntry label="Account number" value={account.account_number} />
      <DetailEntry label="Currency" value={account.currency} />
      <DetailEntry label="Opening date" value={account.opening_date} />
      <DetailEntry label="Opening balance" value={formatMoney(account.opening_balance, account.currency)} />
      <DetailEntry label="Notes" value={account.notes} />
    </dl>
  );
}

/**
 * Rendering helper for the regular account detail header.
 */
const BankAccountHeaderHelper = {
  /**
   * Render the shared account header under the Accounts section, with the regular details
   * (bank, branch, full account number, currency, opening date / balance, notes).
   *
   * @param {{account: object, hasTransactions: boolean, actionPending: (string|null),
   *   context: object}} state - The account, the "has transactions" signal, the in-flight
   *   action and the owner context.
   * @param {{onArchive: Function, onUnarchive: Function, onDeleteAccount: Function}} handlers -
   *   Action handlers.
   * @returns {React.ReactElement} The rendered header.
   */
  render(state, handlers) {
    return AccountHeaderHelper.render({
      ...state, base: ACCOUNTS_BASE, details: renderDetails(state.account),
    }, handlers);
  },
};

export default BankAccountHeaderHelper;
