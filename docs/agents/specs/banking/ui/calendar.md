# Calendar

> **Owned by [#33](https://github.com/darthjee/ward/issues/33).** The data model, recurrence
> rules, payments and routes are defined in [bills.md](../bills.md); this file only specifies the
> pages. The menu entry is in [menu.md](menu.md).

## Summary

- The **Calendar** submenu of the Bank menu (see [menu.md](menu.md)) lives at
  **`<ui>/calendar`** (`<ui>` is `/bank` or `/orgs/:orgId/bank`, see
  [regular.md](../accounts/regular.md#routes-and-permissions)).
- It is **per owner context**: the Personal calendar shows personal bills only; an
  organization's calendar shows only that organization's bills.
- It shows derived occurrences (from debt and provider-expense accounts) and one-off bills
  together, in the [occurrence shape](../bills.md#occurrence-shape) of `bills.md`.
- Totals are grouped **per currency, never summed** across currencies.

## List view

`<ui>/calendar` — the default view.

- **Overdue** section — every open occurrence whose **effective** due date is before today, back
  to `billsFrom` with no age limit, **oldest first**. Data: `<base>/calendar/overdue.json`.
  Hidden when empty.
- **Upcoming** — the next **60 days** (today included), **grouped by week**. Data:
  `<base>/calendar.json?from=<today>&to=<today + 59 days>`. Paid / skipped occurrences in the
  window are shown muted.
- **Totals** — per-currency overdue and upcoming totals of the open occurrences' expected
  amounts (occurrences with no expected amount are counted but add nothing).
- Empty state: "No bills coming up" with an **Add bill** button and a hint that debts and
  providers with a due day appear here.
- A link switches to the [Month view](#month-view).

## Month view

`<ui>/calendar/month?m=YYYY-MM` — defaults to the current month when `m` is missing or invalid.

- A month grid, one cell per day, entries placed on their **effective** due date.
- Browsable with previous / next links from **any past month** up to **12 months ahead** of the
  current month; the "next" link is disabled at the limit and a later `m` is clamped to it.
- **Overdue** entries are highlighted; **paid / skipped** entries are muted.
- One `<base>/calendar.json?from=<first day>&to=<last day>` request per month, well within the
  366-day cap.
- Per-currency totals for the month.

## Entry

Each entry (in both views) shows:

- the **source name** — the account name for derived occurrences, the bill description for
  one-off bills;
- the **expected amount**, formatted with `Intl` in its currency, or none when unset;
- the **effective due date**, plus the nominal date when the weekend shift moved it
  ("due Sat 14, moved to Mon 16");
- the **status** — open, overdue, paid or skipped.

**Link** — to the source account's detail page (`<ui>/debts/:id` or `<ui>/providers/:id`, see
[debt.md](../accounts/debt.md#detail) and
[provider-expense.md](../accounts/provider-expense.md#detail)) for derived occurrences, or to the
one-off bill's edit page (`<ui>/bills/:id/edit`).

**Inline actions**:

- **Pay** (open / overdue entries) — opens a dialog with:
  - **amount**, pre-filled with the expected amount; required when there is none;
  - **paid on**, defaulting to today, not after today;
  - **paying account**, a select of the owner's non-archived `regular` accounts in the entry's
    currency, pre-filled from the default paying account; a choice is required when the default
    is null or archived;
  - **"Also record the charge"** checkbox, shown for **provider** entries (derived and one-off)
    only, **on** by default.

  Submitting posts to the occurrence's or bill's `payment.json` (see
  [bills.md](../bills.md#routes-and-permissions)); a 409 (already paid) reloads the entry.
- **Skip** (open / overdue entries) — asks for confirmation, then posts `status: skipped`.
- **Undo** (paid / skipped entries) — asks for confirmation (it deletes the transactions the
  payment created), then deletes the payment.

## Add / edit bill

`<ui>/bills/new`, `<ui>/bills/:id/edit`

- **Add bill** buttons on the Calendar and on the provider detail page (provider pre-selected,
  `<ui>/bills/new?provider=:id`) open `<ui>/bills/new`.
- Fields and limits follow [One-off bills](../bills.md#one-off-bills): provider, paying account,
  due date (past dates allowed), amount, description, notes.
  - The provider select lists the active owner's non-archived provider-expense accounts.
  - The paying-account select lists the active owner's non-archived `regular` accounts in the
    provider's currency, and is refreshed when the provider changes.
- A 422 from the server is shown on the form without revealing more than the server says.
- **Delete** on the edit page asks for confirmation. When the bill is paid, the server answers
  409 and the page tells the user to undo the payment first.

## Changes to the Debts / Providers pages

- **Create / Edit** (`<ui>/debts/…`, `<ui>/providers/…`) gain three inputs, whose rules are
  owned by [bills.md](../bills.md#schedule-fields-on-source-accounts):
  - **Bills from** (date; filled with today when a due day is first entered);
  - **Show in Calendar** (checkbox, on by default);
  - **Default paying account** (select of the owner's non-archived `regular` accounts in the
    account's currency; optional).
- **Detail** pages gain a **Bill history** list — payments and skips, newest first, including
  **off-schedule** ones (marked as such), each with an **Undo** action. Data:
  `<base>/accounts/:accountId/bill-payments.json`.
- The provider detail page gains the **Add bill** button.

## Security in the UI

- Descriptions, notes and account names are user input, always rendered **escaped** (React
  default).
- No owner fields are shown or sent; links are built from the active context.

## Resolved questions

- [x] The date range shown — an Overdue section plus 60 days Upcoming in the
  [List view](#list-view), and a [Month view](#month-view) up to 12 months ahead.
- [x] What a calendar entry links to — the source account's detail page, or the one-off bill's
  edit page (see [Entry](#entry)).
- [x] How the calendar interacts with paying a bill — inline **Pay** / **Skip** / **Undo**
  actions (see [Entry](#entry)), backed by the payment routes of
  [bills.md](../bills.md#paying-a-bill).

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Skeleton sub-issue: https://github.com/darthjee/ward/issues/27
- Owning sub-issue: https://github.com/darthjee/ward/issues/33
- Bills (data model, recurrence, routes): https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/bills.md
- Bank menu: https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/ui/menu.md
- Debts submenu: https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/debt.md
- Providers submenu: https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/provider-expense.md

## Required tests

**Frontend (Jasmine)**

- List view: the Overdue section lists overdue entries oldest first and is hidden when empty;
  Upcoming covers 60 days grouped by week; per-currency totals, never summed across currencies;
  empty state.
- Month view: defaults to the current month; previous / next navigation; "next" disabled at 12
  months ahead and a later `m` clamped; overdue highlighted, paid / skipped muted.
- Entry: shows the nominal date only when the weekend shift moved it; links to the debt /
  provider detail page or the bill edit page under the active context.
- Pay dialog: amount pre-filled from the expected amount and required when unset; paid-on
  defaults to today; paying account pre-filled from the default and required when the default
  is null or archived; the charge checkbox shown for providers only, on by default.
- Skip and Undo call the right routes after confirmation and refresh the entry.
- Add / edit bill: required fields and limits; the paying-account select filtered by the
  provider's currency; provider pre-selected from the provider detail page; delete of a paid
  bill shows the "undo the payment first" message.
- Debts / Providers forms: the Bills from, Show in Calendar and Default paying account inputs.
- Bill history: lists payments and skips, marks off-schedule entries, offers Undo.
- Descriptions, notes and names are rendered escaped.
