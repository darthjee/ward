import useBillHistory from './hooks/useBillHistory.js';
import BillHistoryHelper from './helpers/BillHistoryHelper.jsx';

/**
 * The **Bill history** of a debt / provider account: its paid and skipped bills, newest due
 * date first, paginated, each with **Undo** (hidden while the account is archived).
 *
 * @param {object} props - Component props.
 * @param {object} props.context - The owner context.
 * @param {object} props.account - The loaded account.
 * @param {string} props.sourceType - The account type (`debt` / `provider_expense`).
 * @param {Function} [props.onUndone] - Called after an undo (reloads the account and ledger).
 * @returns {React.ReactElement} The section.
 */
export default function BillHistory({
  context, account, sourceType, onUndone,
}) {
  const { state, handlers } = useBillHistory({ context, account, onUndone });

  return BillHistoryHelper.render({ ...state, account, sourceType }, handlers);
}
