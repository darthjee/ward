# Bank — UI

The bank pages: the Bank menu, one submenu per account type, Add / edit bill, Bill history, the
accountant hand-off and the Calendar. Part of the [Bank module](../bank.md). The cross-cutting
frontend mechanics (context in the URL, router tables, section registry, remembered context)
are in [Frontend → Owner context](../../architecture/frontend.md#owner-context-organizations).
Code: `frontend/assets/js/components/resources/bank/` and
`components/common/header/bankMenu/`.

## Context and links

- Every page lives under the active context's UI prefix, `<ui>`: `#/bank` (Personal) or
  `#/orgs/:orgId/bank` (organization). Links and API calls are built from the active context,
  so every page works in both; with zero organizations the whole module works in Personal.
- **Switching context** from a bank page lands on the **same section's list** in the new
  context (Accounts, Debts, Investments or Providers), never on the same record id, which would
  404. The one-off bill pages (`<ui>/bills/...`) have no list of their own and land on
  Providers.
- **Wrong-type deep links** redirect to the account's own section (a debt opened under
  `<ui>/accounts/:id` goes to `<ui>/debts/:id`, and so on); `GET /accounts/:id.json` returns any
  type.
- User input (names, notes, descriptions) is always rendered escaped, and no owner field is
  shown or sent.

## Bank menu

The header's **Bank** dropdown has **Accounts**, **Debts**, **Investments** and **Providers**.
The **Calendar** entry comes with the Calendar views (see [Calendar](#calendar)).

## Shared pages

The submenus are built on shared `bank/common` pieces (list, detail with ledger, inline
transaction form, header and archive actions, common form fields, type guard, confirmation
modal, error alert, schedule fields), parameterised per type, never copied
([#55](https://github.com/darthjee/ward/issues/55)).

- **List** — one type only, sorted by name, no pagination, amounts formatted with `Intl` in each
  account's currency and **no grand total** (currencies may differ). A *Show archived* toggle
  reveals archived rows, marked as such. A **New …** button, an empty state with a create
  button, and each row opens the detail page.
- **Detail** — header with every field (full account number) and the current balance; Edit,
  Archive / Unarchive and Delete. Delete shows only on an active account with no transactions
  (read from the ledger's `total_count`). An archived account shows a banner and only Unarchive
  and Rename.
- **Ledger** — date, description, amount, running balance; newest first with the opening row
  last; 50 rows per page through `?page=`. Transactions are added and edited **inline**, in a
  form row at the top of the ledger, with an **In / Out** toggle; deleting asks for
  confirmation; writes are hidden on an archived account. Dates after today are not offered.
- **Create / Edit** — common fields (name, bank, branch, account number, currency, opening date,
  opening balance, notes). The currency is a searchable ISO select defaulting to
  `default_currency` from `settings.json`, locked once the account has transactions. Opening
  date defaults to today, opening balance to 0. `type` is never shown: it comes from the
  submenu.

## Accounts

`<ui>/accounts`, `<ui>/accounts/new`, `<ui>/accounts/:accountId`,
`<ui>/accounts/:accountId/edit`: `regular` accounts. List columns: name, bank, branch, masked
account number, currency, balance.

## Debts

`<ui>/debts…`: `debt` accounts.

- List columns: name, creditor, balance, instalment amount with its frequency ("500,00 /
  month"), interest rate with its period ("1.99% / month"), currency.
- Detail: a debt info block (rate and period, instalment amount, frequency, due day / month,
  count) and the bill [schedule block](#schedule-fields-and-bill-history). **Add payment**
  (positive, "Payment", amount suggested from the instalment) and **Add interest** (negative,
  "Interest") pre-fill the inline form; hidden on an archived debt.
- Create / Edit: "Bank" is **Creditor**, the opening date **Loan date** and the opening balance
  **Amount owed**, typed positive and stored negated (the UI negates both ways; the API keeps
  the signed `opening_balance`). The interest period appears once a rate is entered; the due
  month only for `yearly`.

## Investments

`<ui>/investments…`: `investment` accounts.

- List columns: name, institution, kind, current value, yield rate with its period, maturity
  date, currency. No total row.
- Detail: an investment info block (kind, rate and period, maturity, liquidity D+N). **Add
  application**, **Add withdrawal** (typed positive, posted negative) and **Update value** (posts
  a "Yield" transaction for the difference, or shows "Value unchanged") above the ledger; hidden
  on an archived investment.
- Create / Edit: "Bank" is **Institution**, the opening date **Start date**; **no
  opening-balance field** (always 0). The yield period appears once a rate is entered.

## Providers

`<ui>/providers…`: `provider_expense` accounts.

- List columns: name, provider, balance, expected amount with its frequency ("200,00 / month",
  "—" when unset), for-accountant marker, currency. **New provider** button and an **Accountant
  hand-off** link.
- Detail: a provider info block (tax id, expected amount, frequency, due day / month when set,
  for-accountant flag) and the [schedule block](#schedule-fields-and-bill-history). **Add
  charge** (Out, "Charge", amount from `expected_amount`) and **Add payment** (In, "Payment")
  pre-fill the inline form; hidden on an archived account. An **Add bill** button opens
  `<ui>/bills/new?provider=:id`.
- **Sent charges** show "Sent <local date>" under the description and a **Mark as unsent** link
  (no confirmation; still visible on an archived account). Saving an edit of a sent charge first
  asks for confirmation; deleting one adds the warning to the delete confirmation.
- Create / Edit: "Bank" is **Provider**, the account number **Customer / contract number**;
  provider fields For accountant (on by default), Provider tax id, Expected amount, Frequency,
  Due day, Due month (yearly only).

### Accountant hand-off

`<ui>/providers/accountant`

- Two date inputs, defaulting to the **last full month** of the browser's local date; the API
  receives explicit `YYYY-MM-DD` dates. Client-side checks (both dates, `from` ≤ `to`) show an
  inline message and send nothing; the API's 400s show in the error alert.
- An **Unsent only** toggle, on by default.
- The preview loads on open and reloads whenever a date or the toggle changes; there is no
  Preview button. Download and Mark are disabled while loading.
- The preview list (date, provider, description, amount, currency, sent date) with **per-currency
  totals**, summed exactly in minor units, one line per currency.
- **Download CSV** — exactly the loaded rows, built by a pure module
  (`providers/common/accountantCsv.js`; format in
  [provider-expense.md](provider-expense.md#preview-and-csv)). Allowed on an empty preview.
- **Mark as sent** — enabled when the preview has rows (downloading first is not enforced);
  asks "Mark N charges as sent?", posts the loaded ids, then reloads and shows "N charges
  marked as sent".

## Schedule fields and Bill history

On the Debts and Providers pages:

- **Create / Edit** gain **Bills from** (filled with today when a due day is first entered),
  **Show in Calendar** (on by default) and **Default paying account** (the owner's non-archived
  `regular` accounts in the account's currency; optional).
- **Detail** shows those three values and a **Bill history**: payments and skips, newest first,
  paginated, with an **Off-schedule** badge and an **Undo** action per row.
  - Undo asks for confirmation; it is hidden when the account is archived.
  - For paid provider and one-off payments, the confirmation always warns that the recorded
    charge may already have been sent to the accountant.

## Add / edit bill

`<ui>/bills/new` (optionally `?provider=:id`), `<ui>/bills/:billId/edit`

- Fields: provider (the owner's non-archived provider-expense accounts), paying account (the
  owner's non-archived `regular` accounts in the provider's currency, refreshed when the provider
  changes, **required on create and edit**), due date (past allowed, defaulting to the local
  today), amount, description, notes.
- A 422 from the server is shown on the form without revealing more than the server says; 409
  `BILL_PAID` is shown on save (a provider change on a paid bill) and on delete ("undo the
  payment first").
- **Delete** asks for confirmation.
- Save, cancel and delete return to the provider's detail page (or the Providers list).
- An unavailable `?provider=` (unknown, archived, other owner) is silently dropped from the
  preselect.

## Calendar

**Pending [#77](https://github.com/darthjee/ward/issues/77)** — the Calendar views are not built
yet. Until then a one-off bill can be created and edited, but it is listed nowhere in the UI
(the backend `calendar.json` / `overdue.json` / `bills.json` routes exist). The agreed design:

- **Menu** — a **Calendar** entry in the Bank menu, at `<ui>/calendar`, per owner context.
- **List view** (`<ui>/calendar`, the default):
  - an **Overdue** section, every open occurrence with an effective date before today, oldest
    first, hidden when empty (`overdue.json`);
  - **Upcoming**, the next **60 days** (today included), grouped by week (`calendar.json`);
    paid / skipped entries are muted;
  - per-currency totals of the open expected amounts;
  - an empty state "No bills coming up" with **Add bill** and a hint that debts and providers
    with a due day appear here.
- **Month view** (`<ui>/calendar/month?m=YYYY-MM`) — a month grid on effective dates, browsable
  from any past month up to **12 months ahead** (a later `m` is clamped, an invalid one means
  the current month); overdue highlighted, paid / skipped muted; one `calendar.json` request per
  month; per-currency totals.
- **Entry** — source name (account name, or bill description), expected amount (or none), the
  effective date plus the nominal one when the weekend shift moved it ("due Sat 14, moved to Mon
  16"), and the status. It links to the debt / provider detail page, or to the bill's edit
  page.
- **Pay** dialog (open / overdue) — amount (pre-filled from the expected amount, required when
  there is none), paid on (default today, not after today), paying account (pre-filled from the
  default, required when that is null or archived), and **Also record the charge** for provider
  entries only, on by default. A 409 reloads the entry.
- **Skip** (open / overdue) and **Undo** (paid / skipped) ask for confirmation.

Deferred: one view across Personal and every organization, *Combined calendar across owners*
([#101](https://github.com/darthjee/ward/issues/101)); subscribing from an external calendar
app, *Calendar feed (iCal / `.ics`)* ([#102](https://github.com/darthjee/ward/issues/102)).

## Differences from the original spec

- **The Calendar** (list and month views, Pay / Skip / Undo dialogs, menu entry and
  `calendar.json` client calls) is not built yet: pending #77.
- **Accounts list** has an extra Branch column.
- **Delete** shows only on active accounts with no transactions.
- **Add / edit bill**: save, cancel and delete return to the provider page (or the Providers
  list); the paying account is required on edit too; the due date defaults to the local today;
  409 `BILL_PAID` is shown on save as well as on delete; an unavailable `?provider=` is silently
  dropped.
- **Context switch** — `/bank/bills/...` maps to the Providers list.
- **Bill history**: Undo is hidden on archived accounts; the "sent charge" warning is always
  shown for paid provider and one-off payments; the list is paginated with an "Off-schedule"
  badge.
- **"Bills from" autofill** uses the browser's local today, while the backend fallback uses UTC
  today.
- **Stale remembered context** is checked against the loaded `/orgs.json` list (no 404
  request), and only at the entry hash; a direct stale URL renders `NotFound` with "Go to
  Personal".
- **The accountant CSV** uses CRLF line endings.
