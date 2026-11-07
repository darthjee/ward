# Write the Calendar UI spec

Replace the #27 skeleton in `docs/agents/specs/banking/ui/calendar.md` with the full Calendar
submenu spec. Change the header note to "Owned by #33". Keep the existing link to `menu.md`.
Point to `../bills.md` for the data model, recurrence and routes instead of repeating them.

Sections to write:

1. **Summary**: the Calendar submenu at `<ui>/calendar`, per owner context (Personal shows
   personal bills only, an organization shows only its own). Totals are grouped per currency,
   never summed.
2. **List view (default)**:
   - an **Overdue** section: every open occurrence whose effective due date is before today,
     back to `billsFrom` with no age limit, oldest first;
   - **Upcoming**: the next 60 days, grouped by week;
   - per-currency overdue / upcoming totals.
   - Data comes from `<base>/calendar.json` and `<base>/calendar/overdue.json`.
3. **Month view**:
   - `<ui>/calendar/month?m=YYYY-MM`;
   - browsable from any past month up to 12 months ahead;
   - overdue entries highlighted, paid / skipped entries muted;
   - one `calendar.json` request per month, within the 366-day cap.
4. **Entry**:
   - Content: the source name (account name or bill description), the expected amount (or none),
     the effective due date (plus the nominal date when the weekend shift moved it) and the
     status.
   - Link: to the source account's detail page (Debts / Providers) or to the one-off bill's edit
     page.
   - Inline actions:
     - **Pay** opens a dialog with the amount (pre-filled with the expected amount, required when
       unset), `paidOn` = today, the paying account pre-filled from the default (a choice is
       required when the default is null or archived), and the "Also record the charge"
       checkbox, shown for providers only and on by default;
     - **Skip**;
     - **Undo** on paid / skipped entries.
5. **Add / edit bill**:
   - The **Add bill** button on the Calendar and on the provider detail page (provider
     pre-selected) opens `<ui>/bills/new`.
   - Editing happens at `<ui>/bills/:id/edit`.
   - Form fields and validation follow the `bank_bills` table in `bills.md`. The provider and
     paying-account selects are limited to the active owner, and the paying account must be a
     regular account in the same currency.
   - Delete; when the bill is paid, the user is told to undo the payment first (409).
6. **Changes to the Debts / Providers pages**:
   - the create / edit pages gain the `billsFrom`, `showInCalendar` and default paying-account
     inputs (the rules are owned by `bills.md`);
   - the detail pages gain a **Bill history** list (payments and skips, including off-schedule
     ones), backed by `<base>/accounts/:accountId/bill-payments.json`.
7. **Security in the UI**: descriptions and notes are rendered escaped. No owner fields are shown.
8. **Resolved questions**: close the three skeleton open questions (date range, what an entry
   links to, how the Calendar interacts with paying).
9. **Reference**: GitHub URLs only: Epic #26, #33, the blob URLs of `bills.md`, `menu.md`,
   `accounts/debt.md` and `accounts/provider-expense.md`.
10. **Required tests (Jasmine)**:
    - list view (Overdue section, 60-day upcoming, per-currency totals);
    - month view navigation and its 12-month limit;
    - Pay dialog defaults, and the charge checkbox shown for providers only;
    - Skip / Undo;
    - Add / edit bill form validation;
    - the new inputs on the Debts / Providers forms;
    - Bill history with off-schedule entries;
    - escaped descriptions.

## Files to Change
- `docs/agents/specs/banking/ui/calendar.md` — replace the skeleton with the full Calendar UI
  spec described above.
