# Month view page

Build `<ui>/calendar/month?m=YYYY-MM`.

## Month parameter and navigation

- **Reading `m`.**
  - Read `m` from `currentHash()` during render. The page is not remounted when `?m=` changes,
    but it re-renders through `useOwnerContext()`.
  - Normalise it with `parseMonth(m, localToday())` from step 01. A missing or invalid value
    means the current month, and a later value is clamped to the current month + 12.
- **Loading.**
  - Make **one** `getCalendar(context, monthRange(m))` request per month.
  - Reload when the normalised month or the context changes.
  - Ignore stale responses, using the `isActive` guard of `runLoad`.
- **Navigation.**
  - Previous / next links point to `contextHash(context, '/bank/calendar/month')`, with the
    `?m=` query added through `withHashQuery`.
  - Previous is always enabled.
  - Next is disabled (rendered as a disabled control) when `m === maxMonth(today)`.
- **Header.** The month title uses `monthName` (display locale) plus the year.
- **Back link.** Add a link back to the list view.

## Grid (wide screens)

- Wrap it in `d-none d-md-block`.
- Use 7 columns, Monday to Sunday (ISO, not the locale), built from `monthGridWeeks(m)`.
- Each day cell lists the `CalendarEntry` items (compact variant) whose `effective_date` is that
  day.
- Overdue entries are highlighted, and paid / skipped ones are muted.

## Agenda (narrow screens)

- Wrap it in `d-md-none`.
- It is the same month as a list of only the days that have entries, each day headed by
  `formatDate`.
- The page never scrolls sideways.
- Both blocks are present in the static markup, so specs can assert both.

## Totals and actions

- **Totals.** Use `CalendarTotals` with `columns=['expected','paid','open']` from the response
  totals.
- **Actions.** Use `useCalendarActions`, and `onChanged` reloads the month.
- Errors, loading and `NotFound` are handled as in the list view.

## Specs

Cover:
- the default month (no `m`) and an invalid `m` giving the current month;
- the request range for a 30-day month, a 31-day month and February;
- the previous and next hrefs, including across a year boundary;
- next disabled at +12 months, and a `m` later than that clamped;
- the grid columns starting on Monday;
- overdue entries highlighted and paid / skipped ones muted;
- the agenda list showing only days with entries;
- the expected / paid / open totals for each currency.

## Files to Change
- `frontend/assets/js/components/resources/bank/calendar/pages/BankCalendarMonth.jsx`: new.
- `frontend/assets/js/components/resources/bank/calendar/pages/hooks/useCalendarMonth.js`: new.
- `frontend/assets/js/components/resources/bank/calendar/pages/controllers/CalendarMonthController.js`:
  new.
- `frontend/assets/js/components/resources/bank/calendar/pages/helpers/BankCalendarMonthHelper.jsx`:
  new. Split the grid and agenda renderers into `MonthGrid.jsx` / `MonthAgenda.jsx` under
  `calendar/common/` if needed.
- Matching specs under `frontend/specs/assets/js/components/resources/bank/calendar/`.
