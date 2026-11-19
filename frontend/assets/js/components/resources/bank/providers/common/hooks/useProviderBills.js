import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import ProviderBillsController from '../controllers/ProviderBillsController.js';
import { buildLoadEffect } from '../../../common/runLoad.js';
import { currentHash } from '../../../common/currentHash.js';

/**
 * Build the Bills block handlers. Exported so specs can run them without a React renderer.
 *
 * @param {object} deps - Handler dependencies.
 * @param {ProviderBillsController} deps.controller - The controller.
 * @param {object|null} deps.confirmation - The bill whose Delete is being confirmed.
 * @param {Function} deps.setConfirmation - Opens / closes the Delete confirmation.
 * @param {Function} deps.setPage - Sets the page.
 * @param {object|null} deps.error - The alert's error (may carry `retry`).
 * @param {Function} deps.setError - Sets the alert's error.
 * @returns {object} The handlers.
 */
export function buildProviderBillsHandlers({
  controller, confirmation, setConfirmation, setPage, error, setError,
}) {
  return {
    onNavigate: (page, event) => {
      event?.preventDefault();
      setPage(page);
    },
    onDelete: (bill) => setConfirmation(bill),
    onConfirmDelete: () => (confirmation ? controller.delete(confirmation) : undefined),
    onCancelDelete: () => setConfirmation(null),
    onRetry: () => {
      setError(null);
      error?.retry?.();
    },
    onDismiss: () => setError(null),
  };
}

/**
 * State and handlers of the **Bills** block of a provider detail.
 *
 * @description The page lives in component state, not in the hash (the ledger owns `?page`).
 * @param {{context: object, account: object}} options - The owner context and the provider.
 * @returns {{state: object, handlers: object}} The helper state and its handlers.
 */
export default function useProviderBills({ context, account }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const controller = useMemo(() => new ProviderBillsController({
    context, providerId: account.id, setData, setError, setPending, setConfirmation, reload,
  }), [context, account.id, reload]);

  useEffect(
    () => buildLoadEffect((isActive) => controller.load(page, isActive))(),
    [controller, page, attempt],
  );

  return {
    state: {
      page, data, error, pending, confirmation, selfHref: currentHash(),
    },
    handlers: buildProviderBillsHandlers({
      controller, confirmation, setConfirmation, setPage, error, setError,
    }),
  };
}
