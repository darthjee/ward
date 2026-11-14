import { formatMoney } from '../../common/amounts.js';

/**
 * The per-currency totals of a Calendar view; currencies are never summed together.
 *
 * @param {{totals: Array<object>, columns: Array<string>}} props - The server totals and the
 *   columns to show (`open` for the list view; `expected`, `paid`, `open` for the month view).
 * @returns {React.ReactElement|null} One line per currency, or `null` for no totals.
 */
export default function CalendarTotals({ totals, columns }) {
  if (!totals || totals.length === 0) {
    return null;
  }

  return (
    <ul className="list-unstyled calendar-totals">
      {totals.map((total) => (
        <li key={total.currency}>
          <strong className="me-2">{total.currency}</strong>
          {columns.map((column) => (
            <span key={column} className="me-3">
              {`${column}: ${formatMoney(total[column], total.currency)}`}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
