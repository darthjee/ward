import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import BillHistoryController from '../controllers/BillHistoryController.js';
import { buildLoadEffect } from '../../runLoad.js';
import { currentHash } from '../../currentHash.js';

/**
 * Build the Bill history handlers. Exported so specs can run them without a React renderer.
 *
 * @param {object} deps - Handler dependencies.
 * @param {BillHistoryController} deps.controller - The controller.
 * @param {object|null} deps.confirmation - The row whose Undo is being confirmed.
 * @param {Function} deps.setConfirmation - Opens / closes the Undo confirmation.
 * @param {Function} deps.setPage - Sets the history page.
 * @param {object|null} deps.error - The alert's error (may carry `retry`).
 * @param {Function} deps.setError - Sets the alert's error.
 * @returns {{onNavigate: Function, onUndo: Function, onConfirmUndo: Function,
 *   onCancelUndo: Function, onRetry: Function, onDismiss: Function}} The handlers.
 */
export function buildBillHistoryHandlers({
  controller, confirmation, setConfirmation, setPage, error, setError,
}) {
  return {
    onNavigate: (page, event) => {
      event?.preventDefault();
      setPage(page);
    },
    onUndo: (row) => setConfirmation(row),
    onConfirmUndo: () => (confirmation ? controller.undo(confirmation) : undefined),
    onCancelUndo: () => setConfirmation(null),
    onRetry: () => {
      setError(null);
      error?.retry?.();
    },
    onDismiss: () => setError(null),
  };
}

/**
 * State and handlers of an account's **Bill history** (debt / provider detail pages).
 *
 * @description The page lives in component state, not in the hash (the ledger owns `?page`).
 * Undo opens the shared confirmation; confirming it goes through
 * {@link BillHistoryController#undo}.
 * @param {{context: object, account: object, onUndone: Function}} options - The owner context,
 *   the loaded account and the callback run after an undo (reloads the account).
 * @returns {{state: object, handlers: object}} The helper state (`page`, `data`, `error`,
 *   `pending`, `confirmation`, `selfHref`) and its handlers.
 */
export default function useBillHistory({ context, account, onUndone }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  // The page hands a new callback on every render; a ref keeps the controller (and so the load
  // effect) stable.
  const onUndoneRef = useRef(onUndone);
  const controller = useMemo(() => new BillHistoryController({
    context,
    accountId: account.id,
    setData,
    setError,
    setPending,
    setConfirmation,
    reload,
    onUndone: () => onUndoneRef.current?.(),
  }), [context, account.id, reload]);

  useEffect(() => {
    onUndoneRef.current = onUndone;
  });

  useEffect(
    () => buildLoadEffect((isActive) => controller.load(page, isActive))(),
    [controller, page, attempt],
  );

  return {
    state: {
      page, data, error, pending, confirmation, selfHref: currentHash(),
    },
    handlers: buildBillHistoryHandlers({
      controller, confirmation, setConfirmation, setPage, error, setError,
    }),
  };
}
