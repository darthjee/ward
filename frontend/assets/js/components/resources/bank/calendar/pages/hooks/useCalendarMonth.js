import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import useOwnerContext from '../../../../../common/ownerContext/hooks/useOwnerContext.js';
import CalendarMonthController from '../controllers/CalendarMonthController.js';
import useCalendarActions from '../../common/hooks/useCalendarActions.js';
import { parseMonth } from '../../common/calendarDates.js';
import { buildLoadEffect } from '../../../common/runLoad.js';
import { currentHash } from '../../../common/currentHash.js';
import { localToday } from '../../../common/dates.js';
import { hashQuery } from '../../../../../../utils/routing/hashQuery.js';

/**
 * Build the load effect of a month. Exported so specs can run it without a React renderer.
 *
 * @param {CalendarMonthController} controller - The controller.
 * @param {string} month - The `YYYY-MM` month.
 * @returns {Function} Effect callback, returning a cleanup that drops late answers.
 */
export function buildCalendarMonthLoadEffect(controller, month) {
  return buildLoadEffect((isActive) => controller.load(month, isActive));
}

/**
 * State and handlers of the Calendar month view.
 *
 * @description The month is read from the hash (`?m=YYYY-MM`) on every render and normalised
 * (see `parseMonth`); the data reloads when the month changes, and a late answer of an earlier
 * month is dropped. Pay / Skip / Undo reload the month.
 * @returns {{context: object, month: string, today: string, data: (object|null),
 *   error: (object|null), notFound: boolean, actions: {state: object, handlers: object},
 *   handlers: {onRetry: Function, onDismiss: Function}}} The page state.
 */
export default function useCalendarMonth() {
  const { context: routeContext } = useOwnerContext();
  const [context] = useState(routeContext);
  const today = localToday();
  const month = parseMonth(hashQuery(currentHash()).get('m'), today);
  const [loaded, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const controller = useMemo(() => new CalendarMonthController({
    context, setData, setError, setNotFound, reload,
  }), [context, reload]);
  const actions = useCalendarActions({ context, onChanged: reload });

  useEffect(() => buildCalendarMonthLoadEffect(controller, month)(), [controller, month, attempt]);

  const handlers = {
    onRetry: () => {
      setError(null);
      reload();
    },
    onDismiss: () => setError(null),
  };

  return {
    context,
    month,
    today,
    data: loaded && loaded.month === month ? loaded : null,
    error,
    notFound,
    actions,
    handlers,
  };
}
