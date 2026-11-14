# Calendar date helpers

Add pure date helpers for the calendar. They work on `YYYY-MM-DD` / `YYYY-MM` strings and do
UTC arithmetic (`Date.UTC`), so the browser timezone never shifts a day.

- `addDays(isoDate, n)` returns an ISO date.
- `weekStart(isoDate)` returns the Monday (ISO week start) of that date's week. It does not
  follow the display locale.
- `monthRange(m)` returns `{ from, to }`: the first and last day of the month.
- `parseMonth(m, today)`:
  - returns a valid `YYYY-MM`;
  - a missing value, an invalid value (regex `^\d{4}-(0[1-9]|1[0-2])$`) or an invalid month
    gives the current local month;
  - a value later than the local month + 12 is clamped to the local month + 12;
  - there is no lower bound.
- `shiftMonth(m, delta)` and `maxMonth(today)` (the local month + 12).
- `monthGridWeeks(m)` returns the weeks as arrays of 7 ISO dates, Monday to Sunday. Days that
  belong to the adjacent months are flagged.
- `formatWeekdayDay(isoDate)` returns, for example, "Sat 14". It uses
  `Intl.DateTimeFormat(DisplayLocale.get(), {weekday:'short', day:'numeric', timeZone:'UTC'})`.

Add specs for:
- month and year boundaries and leap years;
- Monday start, including a Sunday date and a Monday date;
- the clamp at +12 months and invalid `m` values (`2026-13`, `abc`, an empty value);
- `upcomingRange(today)`, which returns `[today, today + 59 days]`.

## Files to Change
- `frontend/assets/js/components/resources/bank/calendar/common/calendarDates.js`: new, holds
  the helpers above plus `upcomingRange(today)`.
- `frontend/specs/assets/js/components/resources/bank/calendar/common/calendarDatesSpec.js`:
  new.
