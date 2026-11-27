import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import useCan from '../../../../../common/ownerContext/hooks/useCan.js';
import { ACTIONS } from '../../../../../../utils/permissions/orgPermissions.js';
import ReconcileController, { INITIAL_RECONCILE } from '../controllers/ReconcileController.js';

/**
 * Build the reconcile-mode handlers. Exported so specs can run them without a React renderer.
 *
 * @param {ReconcileController} controller - The controller.
 * @param {object} state - The reconcile state (see {@link useReconcile}).
 * @returns {object} The handlers: `onReconcile`, `onEditStatement`, `onCloseForm`,
 *   `onFieldChange`, `onSubmitStatement`, `onToggle`, `onTickAll`, `onUntickAll`,
 *   `onToggleOnlyUncleared`, `onFinish`, `onCancel`, `onConfirmCancel`, `onDismissCancel` and
 *   `onDismissError`.
 */
export function buildReconcileHandlers(controller, state) {
  return {
    onReconcile: () => controller.open(),
    onEditStatement: () => controller.openEdit(state.statement),
    onCloseForm: () => controller.closeForm(state.statement),
    onFieldChange: (event) => controller.changeField(event.target.name, event.target.value),
    onSubmitStatement: (event) => {
      event?.preventDefault();

      return controller.submitForm(state);
    },
    onToggle: (row) => controller.toggle(row, state),
    onTickAll: (rows) => controller.tickAll(rows, state),
    onUntickAll: (rows) => controller.untickAll(rows, state),
    onToggleOnlyUncleared: () => controller.toggleOnlyUncleared(),
    onFinish: () => controller.finish(state.statement),
    onCancel: () => controller.requestCancel(),
    onConfirmCancel: () => controller.confirmCancel(state.statement),
    onDismissCancel: () => controller.dismissCancel(),
    onDismissError: () => controller.dismissError(),
  };
}

/**
 * State and handlers of the **reconcile mode** of an account detail page.
 *
 * @description The page never starts in reconcile mode. The state is
 * `{ mode: 'off' | 'form' | 'active', statement, formKind, fields, fieldErrors, ticked,
 * onlyUncleared, pending, error, cancelConfirm, historyVersion, canWrite, canCancel }`;
 * `canWrite` / `canCancel` come from the caller's role (UX only, the backend enforces them).
 * @param {{context: object, accountId: (number|string), account: (object|undefined),
 *   reload: Function}} options - The owner context, the account id, the loaded account and the
 *   account + ledger reload.
 * @returns {{reconcile: object, reconcileHandlers: object}} The state and its handlers. The
 *   optimistic ticks are dropped every time the ledger reloads (a new `account`).
 */
export default function useReconcile({
  context, accountId, account, reload,
}) {
  const [state, setState] = useState(INITIAL_RECONCILE);
  const canWrite = useCan(ACTIONS.WRITE);
  const canCancel = useCan(ACTIONS.DELETE);
  const setReconcile = useCallback((patch) => setState((previous) => ({
    ...previous, ...(typeof patch === 'function' ? patch(previous) : patch),
  })), []);
  const controller = useMemo(() => new ReconcileController({
    context, accountId, account, setReconcile, reload,
  }), [context, accountId, account, setReconcile, reload]);

  // A new account object means the ledger reloaded: its rows carry the server's ticks.
  useEffect(() => {
    controller.onLedgerReloaded();
  }, [controller]);

  return {
    reconcile: { ...state, canWrite, canCancel },
    reconcileHandlers: buildReconcileHandlers(controller, state),
  };
}
