import NotFound from '../../../../common/notFound/NotFound.jsx';
import useCalendarMonth from './hooks/useCalendarMonth.js';
import BankCalendarMonthHelper from './helpers/BankCalendarMonthHelper.jsx';

/**
 * Calendar month view (`<ui>/bank/calendar/month?m=YYYY-MM`): one month as a Monday-first grid
 * on wide screens and an agenda on narrow ones, with per-currency expected / paid / open totals
 * and the Pay / Skip / Undo actions. A missing or invalid month is the current one; a month
 * beyond the current one plus 12 is clamped. An unknown organization shows Not-found.
 *
 * @returns {React.ReactElement} The rendered page.
 */
export default function BankCalendarMonth() {
  const state = useCalendarMonth();

  if (state.notFound) {
    return <NotFound orgId={state.context.orgId ?? null} />;
  }

  return BankCalendarMonthHelper.render(state, state.handlers);
}
