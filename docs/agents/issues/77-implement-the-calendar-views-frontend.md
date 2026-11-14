# Issue: Implement the Calendar views — frontend

## Description

Implement the **Calendar** submenu in the frontend: the list view, the month view and the Pay /
Skip / Undo actions on each entry. Split from #57, which added the bill inputs, the one-off bill
pages and the Bill history.

Part of Epic #26. The banking spec folder was folded into the permanent docs by #58, so the
design below is the source of truth: build against it and do not re-decide anything it settles.
When it is unclear or wrong, raise it on the issue instead of deviating silently.

### Reference docs

- `docs/agents/modules/bank/ui.md`: *Calendar*, *Bank menu*, *Display locale*, *Context and
  links*
- `docs/agents/modules/bank/bills.md`: *Occurrence shape*, *Paying, skipping and undoing*,
  *Validation*
- `docs/agents/backend/routes/bank.md`: *Bills and calendar* (the `{ occurrences, totals }`
  envelope, the payment body and the errors, as built by #56)

### Scope

- The **Calendar** entry in the Bank menu, at `<ui>/calendar`, after Providers. The routes go in
  the frontend router and the active-prefix table, under both `/bank` and `/orgs/:orgId/bank`.
- **List view** (`<ui>/calendar`):
  - an **Overdue** section from `calendar/overdue.json`, oldest first, hidden when empty;
  - **Upcoming**: the next 60 days from `calendar.json`, grouped by week, with paid / skipped
    entries muted;
  - per-currency totals;
  - an empty state "No bills coming up" with an **Add bill** button and a hint that debts and
    providers with a due day appear here;
  - a link to the month view.
- **Month view** (`<ui>/calendar/month?m=YYYY-MM`):
  - it defaults to the current month, and an invalid `m` means the current month;
  - previous / next links, from any past month up to 12 months ahead, with a later `m` clamped;
  - one `calendar.json` request per month;
  - overdue entries are highlighted and paid / skipped ones muted;
  - per-currency totals for the month.
- **Entry**:
  - the source name (account name, or bill description), the expected amount (or none), the
    effective date (plus the nominal one when the weekend shift moved it: "due Sat 14, moved to
    Mon 16") and the status;
  - a link to the debt / provider detail page, or to the one-off bill's edit page, under the
    active owner context.
- **Pay** dialog (open / overdue entries):
  - **amount**: pre-filled from the expected amount, required when there is none;
  - **paid on**: today by default, not after today;
  - **paying account**: the non-archived `regular` accounts in the entry's currency, pre-filled
    from `default_paying_account` and required when that is null or archived;
  - **"Also record the charge"**: provider entries only (derived and one-off), on by default;
  - a `409` (already paid) reloads the entry.
- **Skip** (open / overdue) asks for confirmation, then posts `status: skipped`.
- **Undo** (paid / skipped) reuses `UndoPaymentConfirm` from #57, including the sent-charge
  warning.
- **Display**: amounts go through `formatMoney` and dates through `formatDate`, so both follow
  the user's display locale (#65). Names, descriptions and notes are rendered escaped.
- **Docs**: in `docs/agents/modules/bank/ui.md`, drop the "Pending #77" note and the Calendar
  item from *Differences from the original spec*, list Calendar in *Bank menu*, and record the
  decisions below.

### Decisions (points the design leaves open)

- **Week start.** Weeks start on **Monday** (ISO), both for the Upcoming groups and for the
  month grid's columns. This does not follow the display locale. A Saturday / Sunday due date moves to Monday, so a shifted entry lands
  at the start of the next week.
- **Month view at phone width.** The 7-column grid is shown above a breakpoint. Below it, the
  same month is rendered as an agenda list of the days that have entries, so the page never
  scrolls sideways.
- **Totals.**
  - In the list view, Overdue shows each currency's `open` from `overdue.json`, and Upcoming
    shows each currency's `open` from `calendar.json`.
  - The month view shows `expected`, `paid` and `open` per currency.
  - Currencies are never summed.
- **"Today"** is the browser's local date (`localToday`). The Upcoming range is
  `[today, today + 59 days]`. Overdue comes from the server, which uses UTC today.

### Depends on

- #57 (bill inputs, one-off bill pages and Bill history — frontend), merged.
- #56 (bills and the calendar — backend), merged.
- #65 (display locale), merged.

### Acceptance criteria

Jasmine specs cover, and pass:

- **List view**: Overdue lists overdue entries oldest first and is hidden when empty; Upcoming
  covers 60 days grouped by Monday-start weeks; per-currency totals, never summed across
  currencies; the empty state.
- **Month view**: defaults to the current month; previous / next navigation; "next" disabled at
  12 months ahead and a later `m` clamped; overdue highlighted, paid / skipped muted; the
  narrow-screen agenda list; the expected / paid / open totals.
- **Entry**: shows the nominal date only when the weekend shift moved it; links to the debt /
  provider detail page or the bill edit page under the active context.
- **Pay dialog**: amount pre-filled from the expected amount and required when unset; paid-on
  defaults to today; paying account pre-filled from the default and required when the default
  is null or archived; the charge checkbox shown for providers only, on by default; a 409
  reloads the entry.
- **Skip and Undo** call the right routes after confirmation and refresh the entry.
- Names, descriptions and notes are rendered escaped.

The existing frontend specs still pass, and lint passes.
