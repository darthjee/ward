import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import useOwnerContext from '../../../../../common/ownerContext/hooks/useOwnerContext.js';
import AccountantHandoffController, { initialHandoff, rangeError } from '../controllers/AccountantHandoffController.js';
import { buildLoadEffect } from '../../../common/runLoad.js';

/** The range inputs of the page. */
const RANGE_FIELDS = new Set(['from', 'to']);

/**
 * Build the hand-off page handlers.
 *
 * @param {object} state - Page state.
 * @param {Function} update - Merges a patch into the page state.
 * @param {AccountantHandoffController} controller - The page controller.
 * @returns {object} The handlers (see {@link useAccountantHandoff}).
 */
export function buildHandoffHandlers(state, update, controller) {
  return {
    onRangeChange: (event) => {
      const { name, value } = event.target;

      if (RANGE_FIELDS.has(name)) {
        update({ ...Object.fromEntries([[name, value]]), success: null });
      }
    },
    onUnsentOnlyChange: (event) => update({ unsentOnly: Boolean(event.target.checked), success: null }),
    onDownload: () => controller.downloadCsv(state),
    onMarkSent: () => update({ confirming: true }),
    onConfirmMarkSent: () => controller.markSent(state),
    onCancelMarkSent: () => update({ confirming: false }),
    onRetry: () => state.error?.retry?.(),
    onDismiss: () => update({ error: null }),
    onDismissSuccess: () => update({ success: null }),
  };
}

/**
 * Build the load effect of the preview for the current range and toggle; its cleanup drops a
 * late answer once the range or the toggle changed. Exported so specs can run it without a
 * React renderer.
 *
 * @param {AccountantHandoffController} controller - The page controller.
 * @param {{from: string, to: string, unsentOnly: boolean}} query - The range and the toggle.
 * @returns {Function} Effect callback, returning the cleanup.
 */
export function buildHandoffLoadEffect(controller, { from, to, unsentOnly }) {
  return buildLoadEffect((isActive) => controller.load({ from, to, unsentOnly }, isActive));
}

/**
 * State and handlers of the accountant hand-off page.
 *
 * @description The preview loads on open and reloads whenever a date or the "Unsent only"
 * toggle changes, once the client-side range check passes (no Preview button); a stale answer
 * of an earlier range is dropped. The page is remounted on a context change (see AppHelper),
 * so the first context is kept.
 * @returns {{context: object, state: object, handlers: {onRangeChange: Function,
 *   onUnsentOnlyChange: Function, onDownload: Function, onMarkSent: Function,
 *   onConfirmMarkSent: Function, onCancelMarkSent: Function, onRetry: Function,
 *   onDismiss: Function, onDismissSuccess: Function}}} The owner context, the page state
 *   (with `rangeError`) and its handlers.
 */
export default function useAccountantHandoff() {
  const { context: routeContext } = useOwnerContext();
  const [context] = useState(routeContext);
  const [state, setState] = useState(() => initialHandoff());
  const [attempt, setAttempt] = useState(0);
  const update = useCallback((patch) => setState((current) => ({ ...current, ...patch })), []);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const controller = useMemo(() => new AccountantHandoffController({ context, update, reload }), [context, update, reload]);
  const { from, to, unsentOnly } = state;

  useEffect(
    () => buildHandoffLoadEffect(controller, { from, to, unsentOnly })(),
    [controller, from, to, unsentOnly, attempt],
  );

  return {
    context,
    state: { ...state, rangeError: rangeError(state) },
    handlers: buildHandoffHandlers(state, update, controller),
  };
}
