import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import useOwnerContext from '../../../../../common/ownerContext/hooks/useOwnerContext.js';
import CalendarListController from '../controllers/CalendarListController.js';
import useCalendarActions from '../../common/hooks/useCalendarActions.js';
import { buildLoadEffect } from '../../../common/runLoad.js';

/**
 * Build the load effect of the list view. Exported so specs can run it without a React
 * renderer.
 *
 * @param {CalendarListController} controller - The controller.
 * @returns {Function} Effect callback, returning a cleanup that drops late answers.
 */
export function buildCalendarListLoadEffect(controller) {
  return buildLoadEffect((isActive) => controller.load(isActive));
}

/**
 * State and handlers of the Calendar list view.
 *
 * @description The page is remounted on a context change (see AppHelper), so the first context
 * is kept. Pay / Skip / Undo reload both requests.
 * @returns {{context: object, data: (object|null), error: (object|null), notFound: boolean,
 *   actions: {state: object, handlers: object}, handlers: {onRetry: Function,
 *   onDismiss: Function}}} The page state and its load-alert handlers.
 */
export default function useCalendarList() {
  const { context: routeContext } = useOwnerContext();
  const [context] = useState(routeContext);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const controller = useMemo(() => new CalendarListController({
    context, setData, setError, setNotFound, reload,
  }), [context, reload]);
  const actions = useCalendarActions({ context, onChanged: reload });

  useEffect(() => buildCalendarListLoadEffect(controller)(), [controller, attempt]);

  const handlers = {
    onRetry: () => {
      setError(null);
      reload();
    },
    onDismiss: () => setError(null),
  };

  return {
    context, data, error, notFound, actions, handlers,
  };
}
