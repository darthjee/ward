import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import { monthName } from '../../../common/dates.js';
import { CALENDAR_BASE } from '../../../common/sections.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import { withHashQuery } from '../../../../../../utils/routing/hashQuery.js';
import CalendarActions from '../../common/CalendarActions.jsx';
import CalendarTotals from '../../common/CalendarTotals.jsx';
import MonthAgenda from '../../common/MonthAgenda.jsx';
import MonthGrid from '../../common/MonthGrid.jsx';
import { maxMonth, shiftMonth } from '../../common/calendarDates.js';
import { entriesByDay } from '../controllers/CalendarMonthController.js';

const TOTAL_COLUMNS = ['expected', 'paid', 'open'];

/**
 * Build the hash of a month of the month view.
 *
 * @param {object} context - The owner context.
 * @param {string} month - The `YYYY-MM` month.
 * @returns {string} The hash with its `?m=` query.
 */
function monthHref(context, month) {
  return withHashQuery(contextHash(context, `${CALENDAR_BASE}/month`), { m: month });
}

/**
 * Render the previous / next navigation; Next is a disabled control at the last month.
 *
 * @param {{context: object, month: string, today: string}} state - Page state.
 * @returns {React.ReactElement} The navigation.
 */
function renderNav({ context, month, today }) {
  const title = `${monthName(Number(month.slice(5)))} ${month.slice(0, 4)}`;
  const atMax = month === maxMonth(today);

  return (
    <div className="d-flex align-items-center gap-2 mb-3">
      <a className="btn btn-outline-secondary" href={monthHref(context, shiftMonth(month, -1))}>Previous</a>
      <h2 className="h4 mb-0 mx-2">{title}</h2>
      {atMax
        ? <span className="btn btn-outline-secondary disabled" aria-disabled="true">Next</span>
        : <a className="btn btn-outline-secondary" href={monthHref(context, shiftMonth(month, 1))}>Next</a>}
    </div>
  );
}

/**
 * Render the totals, the grid and the agenda of a loaded month.
 *
 * @param {{context: object, month: string, data: (object|null), error: (object|null)}} state -
 *   Page state.
 * @param {object} handlers - The action handlers.
 * @returns {React.ReactElement|null} The body.
 */
function renderBody({
  context, month, data, error,
}, handlers) {
  if (!data) {
    return error ? null : <p className="text-muted">Loading…</p>;
  }

  const byDay = entriesByDay(data.occurrences);

  return (
    <>
      <CalendarTotals totals={data.totals} columns={TOTAL_COLUMNS} />
      <MonthGrid month={month} byDay={byDay} context={context} handlers={handlers} />
      <MonthAgenda byDay={byDay} context={context} handlers={handlers} />
    </>
  );
}

/**
 * Rendering helper for the Calendar month view.
 */
const BankCalendarMonthHelper = {
  /**
   * Render the month view: the header with the link back to the list view, the month
   * navigation, the error alert, the totals, the grid (wide screens) and the agenda (narrow
   * screens), and the action dialogs.
   *
   * @param {{context: object, month: string, today: string, data: (object|null),
   *   error: (object|null), actions: {state: object, handlers: object}}} state - The page
   *   state.
   * @param {{onRetry: Function, onDismiss: Function}} handlers - Load alert handlers.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    const { context, actions } = state;

    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 className="h3 mb-0">Calendar</h1>
          <a className="btn btn-outline-primary" href={contextHash(context, CALENDAR_BASE)}>List view</a>
        </div>
        {renderNav(state)}
        <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
        <CalendarActions state={actions.state} handlers={actions.handlers} />
        {renderBody(state, actions.handlers)}
      </div>
    );
  },
};

export default BankCalendarMonthHelper;
