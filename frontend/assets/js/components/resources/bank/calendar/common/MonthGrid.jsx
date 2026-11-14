import { formatWeekday, monthGridWeeks } from './calendarDates.js';
import CalendarEntry from './CalendarEntry.jsx';
import { occurrenceKey } from './occurrenceKey.js';

/**
 * Render one day cell of the grid.
 *
 * @param {{day: {date: string, inMonth: boolean}, entries: Array<object>, context: object,
 *   handlers: object}} props - The day, its entries, the owner context and the action handlers.
 * @returns {React.ReactElement} The cell.
 */
function DayCell({
  day, entries, context, handlers,
}) {
  return (
    <div className={`calendar-day border p-1${day.inMonth ? '' : ' text-muted bg-light'}`}>
      <div className="small fw-bold">{Number(day.date.slice(8))}</div>
      {entries.map((occurrence) => (
        <CalendarEntry
          key={occurrenceKey(occurrence)}
          context={context}
          occurrence={occurrence}
          variant="compact"
          onPay={handlers.onPay}
          onSkip={handlers.onSkip}
          onUndo={handlers.onUndo}
        />
      ))}
    </div>
  );
}

/**
 * The month as a 7-column grid, Monday to Sunday (ISO, not the locale), for wide screens.
 *
 * @param {{month: string, byDay: Map<string, Array<object>>, context: object,
 *   handlers: object}} props - The `YYYY-MM` month, the entries per effective date, the owner
 *   context and the action handlers.
 * @returns {React.ReactElement} The grid, hidden below the `md` breakpoint.
 */
export default function MonthGrid({
  month, byDay, context, handlers,
}) {
  const weeks = monthGridWeeks(month);

  return (
    <div className="d-none d-md-block calendar-grid">
      <div className="d-grid text-center fw-bold" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {weeks[0].map((day) => <div key={day.date}>{formatWeekday(day.date)}</div>)}
      </div>
      {weeks.map((week) => (
        <div key={week[0].date} className="d-grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {week.map((day) => (
            <DayCell key={day.date} day={day} entries={byDay.get(day.date) ?? []} context={context} handlers={handlers} />
          ))}
        </div>
      ))}
    </div>
  );
}
