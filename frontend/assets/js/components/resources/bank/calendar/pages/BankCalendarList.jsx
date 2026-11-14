import NotFound from '../../../../common/notFound/NotFound.jsx';
import useCalendarList from './hooks/useCalendarList.js';
import BankCalendarListHelper from './helpers/BankCalendarListHelper.jsx';

/**
 * Calendar list view (`<ui>/bank/calendar`): the Overdue entries (hidden when none) and the
 * Upcoming ones for the next 60 days, grouped by week, with per-currency totals and the Pay /
 * Skip / Undo actions. An unknown organization shows Not-found.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankCalendarList() {
  const state = useCalendarList();

  if (state.notFound) {
    return <NotFound orgId={state.context.orgId ?? null} />;
  }

  return BankCalendarListHelper.render(state, state.handlers);
}
