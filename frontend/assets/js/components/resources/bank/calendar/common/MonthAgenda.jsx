import { formatDate } from '../../common/dates.js';
import CalendarEntry from './CalendarEntry.jsx';
import { occurrenceKey } from './occurrenceKey.js';

/**
 * The month as a list of only the days that have entries, for narrow screens.
 *
 * @param {{byDay: Map<string, Array<object>>, context: object, handlers: object}} props - The
 *   entries per effective date, the owner context and the action handlers.
 * @returns {React.ReactElement} The agenda, hidden from the `md` breakpoint up.
 */
export default function MonthAgenda({ byDay, context, handlers }) {
  const days = [...byDay.keys()].sort();

  return (
    <div className="d-md-none calendar-agenda">
      {days.map((date) => (
        <div key={date} className="mb-3">
          <h3 className="h6">{formatDate(date)}</h3>
          {byDay.get(date).map((occurrence) => (
            <CalendarEntry
              key={occurrenceKey(occurrence)}
              context={context}
              occurrence={occurrence}
              variant="list"
              onPay={handlers.onPay}
              onSkip={handlers.onSkip}
              onUndo={handlers.onUndo}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
