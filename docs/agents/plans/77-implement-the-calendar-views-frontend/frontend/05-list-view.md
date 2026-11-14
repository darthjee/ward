# List view page

Build `<ui>/calendar`, following the `pages/` pattern: a thin page, a hook, a controller and a
helper.

## Loading

- Load `getOverdue(context)` and `getCalendar(context, ...upcomingRange(localToday()))` with
  `runLoad`. The pure load effect is exported for specs.
- Show `Loading…` until both requests answer.
- Errors go through `BankErrorAlert` with Retry.
- An unknown organization renders `<NotFound orgId>`.

## Overdue section

- It contains the `overdue.json` occurrences, oldest first, in server order.
- It is **hidden when empty**.
- Its totals are `CalendarTotals` with `columns=['open']`, from the `overdue.json` totals.

## Upcoming section

- It contains the `calendar.json` occurrences, minus those whose `occurrenceKey` already appears
  in Overdue (the day-boundary de-duplication).
- Group them by `weekStart(effective_date)`, Monday start. Each group gets a heading such as
  "Week of <formatDate(monday)>".
- Paid and skipped entries are muted, which `CalendarEntry` handles.
- Its totals are `CalendarTotals` with `columns=['open']`, from the `calendar.json` totals.

## Empty state

When both lists are empty:
- show "No bills coming up";
- show an **Add bill** button linking to `contextHash(context, '/bank/bills/new')`;
- show a hint that debts and providers with a due day appear here.

## Links and actions

- Add a **Month view** link to `contextHash(context, '/bank/calendar/month')`.
- The actions use `useCalendarActions`, and `onChanged` reloads both requests.

## Specs

Cover:
- Overdue oldest first, and hidden when empty;
- Upcoming covering 60 days (the request is `from=today&to=today+59`);
- Monday-start week grouping, with an entry shifted from a weekend landing in the next week;
- per-currency totals that are never summed;
- the empty state with the Add bill link under both contexts;
- the de-duplication;
- the month view link;
- escaped names.

## Files to Change
- `frontend/assets/js/components/resources/bank/calendar/pages/BankCalendarList.jsx`: new.
- `frontend/assets/js/components/resources/bank/calendar/pages/hooks/useCalendarList.js`: new.
- `frontend/assets/js/components/resources/bank/calendar/pages/controllers/CalendarListController.js`:
  new. It holds the grouping and de-duplication as pure functions.
- `frontend/assets/js/components/resources/bank/calendar/pages/helpers/BankCalendarListHelper.jsx`:
  new.
- Matching specs under `frontend/specs/assets/js/components/resources/bank/calendar/pages/`.
