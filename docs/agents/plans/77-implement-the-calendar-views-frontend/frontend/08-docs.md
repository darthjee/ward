# Documentation update

The architect owns `docs/agents/`. The frontend agent reports anything that differs from the
plan, and the architect makes these edits during integration (or the frontend agent makes them
when the architect delegates it).

## `docs/agents/modules/bank/ui.md`

- **Bank menu.** List **Calendar** after Providers, and drop the line "comes with the Calendar
  views".
- **Calendar.**
  - Drop the "Pending #77" paragraph, and keep the design as the description of what is built.
  - Record the decisions:
    - weeks start on Monday (ISO) for the Upcoming groups and for the month grid, regardless of
      the display locale;
    - below the `md` breakpoint the month view is shown as an agenda list of the days that have
      entries;
    - the list-view totals show `open` (Overdue from `overdue.json`, Upcoming from
      `calendar.json`), and the month view shows `expected` / `paid` / `open`, never summed
      across currencies;
    - "today" is the browser's local date, Upcoming covers `[today, today + 59]`, and Overdue
      uses the server's UTC today;
    - Upcoming drops occurrences already listed in Overdue;
    - a 409 on Pay or Skip reloads the view's data;
    - the context switch from a calendar page lands on the Calendar list.
- **Differences from the original spec.** Remove the Calendar bullet. Add any deviation found
  during implementation (for example, a paid-on limit of the local today against the server's
  UTC + 1).

## `docs/agents/architecture/frontend.md`

In *Section registry* (around line 248), mention the `/bank/calendar` section row.

## Files to Change
- `docs/agents/modules/bank/ui.md`: the updates above.
- `docs/agents/architecture/frontend.md`: the section registry mention.
