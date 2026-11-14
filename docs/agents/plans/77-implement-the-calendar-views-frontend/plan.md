# Plan: Implement the Calendar views — frontend

Issue: [77-implement-the-calendar-views-frontend.md](../../issues/77-implement-the-calendar-views-frontend.md)

## Overview
Build the Bank **Calendar** submenu in the frontend: the list view (Overdue + Upcoming 60 days
grouped by Monday-start weeks), the month view (7-column grid above a breakpoint, agenda list
below it), the calendar entry, and the Pay / Skip / Undo actions. It also adds the calendar and
payment client calls, the router, section and menu wiring, and the `ui.md` doc update. The
backend (#56) already exists, so no backend, proxy or cache change is needed.

See [frontend.md](frontend.md) for the full plan.
