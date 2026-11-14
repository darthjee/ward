import { useMemo, useRef, useState, useEffect } from 'react';
import CalendarActionsController from '../controllers/CalendarActionsController.js';
import usePayingAccounts from '../../../common/form/hooks/usePayingAccounts.js';

/**
 * Build the Calendar action handlers. Exported so specs can run them without a React renderer.
 *
 * @param {object} deps - Handler dependencies.
 * @param {CalendarActionsController} deps.controller - The controller.
 * @param {{dialog: (object|null), fields: object, error: (object|null), accounts: *}} deps.state
 *   - The current action state.
 * @param {Function} deps.setFields - Sets the Pay dialog fields.
 * @param {Function} deps.setError - Sets the alert's error.
 * @returns {{onPay: Function, onSkip: Function, onUndo: Function, onFieldChange: Function,
 *   onConfirm: Function, onCancel: Function, onRetry: Function, onDismiss: Function}} The
 *   handlers.
 */
export function buildCalendarActionsHandlers({
  controller, state, setFields, setError,
}) {
  const confirmers = new Map([
    ['pay', (occ) => controller.confirmPay(occ, state.fields)],
    ['skip', (occ) => controller.confirmSkip(occ)],
    ['undo', (occ) => controller.confirmUndo(occ)],
  ]);

  return {
    onPay: (occ) => controller.openPay(occ, state.accounts),
    onSkip: (occ) => controller.openConfirm('skip', occ),
    onUndo: (occ) => controller.openConfirm('undo', occ),
    onFieldChange: ({ target: { name, value } }) => setFields((fields) => ({ ...fields, [name]: value })),
    onConfirm: () => (state.dialog ? confirmers.get(state.dialog.type)(state.dialog.occurrence) : undefined),
    onCancel: () => controller.close(),
    onRetry: () => {
      setError(null);
      state.error?.retry?.();
    },
    onDismiss: () => setError(null),
  };
}

/**
 * State and handlers of the Calendar's Pay / Skip / Undo actions.
 *
 * @description Loads the paying accounts once per view and owns the dialog state.
 * @param {{context: object, onChanged: Function}} options - The owner context and the callback
 *   run when the view must reload.
 * @returns {{state: object, handlers: object}} The state (`dialog`, `fields`, `fieldErrors`,
 *   `pending`, `error`, `accounts`) and its handlers.
 */
export default function useCalendarActions({ context, onChanged }) {
  const accounts = usePayingAccounts(context);
  const [dialog, setDialog] = useState(null);
  const [fields, setFields] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  // The page hands a new callback on every render; a ref keeps the controller stable.
  const onChangedRef = useRef(onChanged);
  const controller = useMemo(() => new CalendarActionsController({
    context, setDialog, setFields, setFieldErrors, setPending, setError,
    onChanged: () => onChangedRef.current?.(),
  }), [context]);

  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  const state = {
    dialog, fields, fieldErrors, pending, error, accounts,
  };

  return {
    state,
    handlers: buildCalendarActionsHandlers({
      controller, state, setFields, setError,
    }),
  };
}
