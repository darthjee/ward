import useStatementsHistory from './hooks/useStatementsHistory.js';
import StatementsHistoryHelper from './helpers/StatementsHistoryHelper.jsx';
import useCan from '../../../../common/ownerContext/hooks/useCan.js';
import { ACTIONS } from '../../../../../utils/permissions/orgPermissions.js';

/**
 * The **Statements history** of an account: its reconciliation statements, newest first with
 * the open one on top, paginated, each undoable statement with **Undo** (hidden for a role that
 * may not undo reconciliations).
 *
 * @param {object} props - Component props.
 * @param {object} props.context - The owner context.
 * @param {object} props.account - The loaded account.
 * @param {number} props.historyVersion - Changes whenever the history must reload (a finish,
 *   a cancel or an undo).
 * @param {Function} [props.onUndone] - Called after an undo (reloads the account and ledger).
 * @returns {React.ReactElement} The section.
 */
export default function StatementsHistory({
  context, account, historyVersion, onUndone,
}) {
  const { state, handlers } = useStatementsHistory({
    context, account, historyVersion, onUndone,
  });
  const canUndo = useCan(ACTIONS.UNDO_RECONCILIATION);

  return StatementsHistoryHelper.render({ ...state, account, canUndo }, handlers);
}
