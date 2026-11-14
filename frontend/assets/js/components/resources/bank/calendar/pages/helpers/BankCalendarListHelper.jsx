import BankErrorAlert from '../../../common/BankErrorAlert.jsx';
import { formatDate } from '../../../common/dates.js';
import { contextHash } from '../../../../../../utils/context/ownerContext.js';
import CalendarActions from '../../common/CalendarActions.jsx';
import CalendarEntry from '../../common/CalendarEntry.jsx';
import CalendarTotals from '../../common/CalendarTotals.jsx';
import { occurrenceKey } from '../../common/occurrenceKey.js';
import { dedupeUpcoming, groupByWeek } from '../controllers/CalendarListController.js';

const OPEN_COLUMNS = ['open'];

/**
 * Render a list of entries.
 *
 * @param {Array<object>} occurrences - The occurrences.
 * @param {{context: object, handlers: object}} options - The owner context and action handlers.
 * @returns {Array<React.ReactElement>} The entries.
 */
function renderEntries(occurrences, { context, handlers }) {
  return occurrences.map((occurrence) => (
    <CalendarEntry
      key={occurrenceKey(occurrence)}
      context={context}
      occurrence={occurrence}
      variant="list"
      onPay={handlers.onPay}
      onSkip={handlers.onSkip}
      onUndo={handlers.onUndo}
    />
  ));
}

/**
 * Render the Overdue section, hidden when empty.
 *
 * @param {{occurrences: Array<object>, totals: Array<object>}} overdue - The overdue data.
 * @param {object} options - The owner context and action handlers.
 * @returns {React.ReactElement|null} The section, or `null`.
 */
function renderOverdue(overdue, options) {
  if (overdue.occurrences.length === 0) {
    return null;
  }

  return (
    <section className="mb-4">
      <h2 className="h5 text-danger">Overdue</h2>
      <CalendarTotals totals={overdue.totals} columns={OPEN_COLUMNS} />
      {renderEntries(overdue.occurrences, options)}
    </section>
  );
}

/**
 * Render the Upcoming section, grouped by week.
 *
 * @param {{occurrences: Array<object>, totals: Array<object>}} upcoming - The upcoming data,
 *   already without the occurrences listed in Overdue.
 * @param {object} options - The owner context and action handlers.
 * @returns {React.ReactElement|null} The section, or `null` when there is nothing.
 */
function renderUpcoming(upcoming, options) {
  if (upcoming.occurrences.length === 0) {
    return null;
  }

  return (
    <section className="mb-4">
      <h2 className="h5">Upcoming</h2>
      <CalendarTotals totals={upcoming.totals} columns={OPEN_COLUMNS} />
      {groupByWeek(upcoming.occurrences).map((group) => (
        <div key={group.weekStart} className="mb-3">
          <h3 className="h6 text-muted">{`Week of ${formatDate(group.weekStart)}`}</h3>
          {renderEntries(group.occurrences, options)}
        </div>
      ))}
    </section>
  );
}

/**
 * Render the empty state.
 *
 * @param {object} context - The owner context.
 * @returns {React.ReactElement} The message, the Add bill button and the hint.
 */
function renderEmpty(context) {
  return (
    <div className="text-center my-5">
      <p>No bills coming up</p>
      <a className="btn btn-primary" href={contextHash(context, '/bank/bills/new')}>Add bill</a>
      <p className="text-muted mt-3">Debts and providers with a due day appear here.</p>
    </div>
  );
}

/**
 * Render the body: the loading notice, the empty state or the two sections.
 *
 * @param {{context: object, data: (object|null), error: (object|null)}} state - Page state.
 * @param {object} handlers - The action handlers.
 * @returns {React.ReactElement|null} The body.
 */
function renderBody({ context, data, error }, handlers) {
  if (!data) {
    return error ? null : <p className="text-muted">Loading…</p>;
  }

  const upcoming = { ...data.upcoming, occurrences: dedupeUpcoming(data.upcoming.occurrences, data.overdue.occurrences) };

  if (data.overdue.occurrences.length === 0 && upcoming.occurrences.length === 0) {
    return renderEmpty(context);
  }

  return (
    <>
      {renderOverdue(data.overdue, { context, handlers })}
      {renderUpcoming(upcoming, { context, handlers })}
    </>
  );
}

/**
 * Rendering helper for the Calendar list view.
 */
const BankCalendarListHelper = {
  /**
   * Render the list view: the header with the **Month view** link, the error alert, the
   * Overdue and Upcoming sections (or the empty state) and the action dialogs.
   *
   * @param {{context: object, data: (object|null), error: (object|null),
   *   actions: {state: object, handlers: object}}} state - The page state.
   * @param {{onRetry: Function, onDismiss: Function}} handlers - Load alert handlers.
   * @returns {React.ReactElement} The rendered page.
   */
  render(state, handlers) {
    const { context, actions } = state;

    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 className="h3 mb-0">Calendar</h1>
          <a className="btn btn-outline-primary" href={contextHash(context, '/bank/calendar/month')}>Month view</a>
        </div>
        <BankErrorAlert error={state.error} onRetry={handlers.onRetry} onDismiss={handlers.onDismiss} />
        <CalendarActions state={actions.state} handlers={actions.handlers} />
        {renderBody(state, actions.handlers)}
      </div>
    );
  },
};

export default BankCalendarListHelper;
