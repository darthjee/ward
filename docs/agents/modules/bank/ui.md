# Bank — UI

The bank pages: the Bank menu, one submenu per account type, the provider bills, Add / edit
bill, Bill history, the accountant hand-off and the Calendar. Part of the [Bank module](../bank.md). The cross-cutting
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
- **Role-gated controls** — in an organization, a `user` does not see the admin-only controls
  (account New / Edit / Archive / Unarchive / Delete, transaction and bill Delete, payment
  Undo, organization Rename), and admin-only pages opened by URL show a permission message
  instead. The list and the mechanics are in
  [Frontend → Owner context](../../architecture/frontend.md#owner-context-organizations); the
  rules are in [Organizations → Roles](../auth/organizations.md#roles).

## Display locale

Amounts, rates, month and currency names follow the user's display locale (*My account*), and
every displayed date goes through `formatDate`. Amount input parsing, native date inputs, API
values and the accountant CSV do not change. See the Display locale section of
[frontend architecture](../../architecture/frontend.md).

## Bank menu

The header's **Bank** dropdown has **Accounts**, **Debts**, **Investments**, **Providers** and **Calendar** (see [Calendar](#calendar)).

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

`<ui>/providers…`: `provider_expense` accounts. A provider holds N
[provider bills](bills.md#provider-bills) (epic [#119](https://github.com/darthjee/ward/issues/119)).

- **List** — columns name, provider, balance, **Bills**, for-accountant marker, currency (no total
  row). **New provider** button and an **Accountant hand-off** link. The right-aligned **Bills**
  column is read from the list payload's `bills_summary` (no per-row request), e.g.
  `3 bills · R$ 250,00 / month + R$ 1.200,00 / year`:
  - singular `1 bill`, plural `N bills`;
  - a zero sum is omitted (`null` and `"0.00"` both count as zero);
  - one-offs and recurring bills without an expected amount count toward N but not the sums;
  - `count: 0` → `—`; a missing `bills_summary` → an **empty** cell, not `—`;
  - the sums are in the provider's single currency;
  - each part (`3 bills`, `R$ 250,00 / month`, `R$ 1.200,00 / year`) stays whole on one line; the
    cell wraps only between parts (at ` · ` and ` + `);
  - archived providers follow the same rules (the row is muted, with the archived badge).
- **Detail**:
  - A provider info block with the tax id and the for-accountant flag (no expected amount,
    frequency or due day: those live on the bills).
  - A **Bills** block below the header, paginated ("No bills yet." when empty): one row per bill
    with description, **kind badge** (Recurring / One-off), expected amount (with its frequency
    for recurring bills, `—` when unset) and due (`Day N` or `Day N of <Month>` for recurring,
    the due date for one-offs). Actions: **Add bill** (`<ui>/bills/new?provider=:id`, also in the
    shortcut bar), **Edit**, **Delete** (with confirmation) and **History**. A delete refused
    with `PROVIDER_BILL_PAID` says, for a recurring bill, to untick *Show in calendar* instead,
    and for a one-off to undo the payment first.
  - On an archived provider, Add bill, Edit and Delete are hidden, but every row (one-offs
    included) keeps its **History** link, which opens the read-only per-bill history (Undo
    hidden).
  - **Add charge** (Out, "Charge") and **Add payment** (In, "Payment") pre-fill the inline form;
    hidden on an archived account. Add charge prefills the amount from the provider's **single**
    recurring bill; with zero or several it stays empty.
- **Sent charges** show "Sent <local date>" under the description and a **Mark as unsent** link
  (no confirmation; still visible on an archived account). Saving an edit of a sent charge first
  asks for confirmation; deleting one adds the warning to the delete confirmation.
- **Create / Edit** — "Bank" is **Provider**, the account number **Customer / contract number**;
  the provider fields are only **For accountant** (on by default) and **Provider tax id**. No
  schedule field is shown or sent.

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

**Debts** keep the account-level schedule:

- **Create / Edit** gain **Bills from** (filled with today when a due day is first entered),
  **Show in Calendar** (on by default) and **Default paying account** (the owner's non-archived
  `regular` accounts in the account's currency; optional).
- **Detail** shows those three values and a **Bill history**: payments and skips, newest first,
  paginated, with an **Off-schedule** badge and an **Undo** action per row. Undo asks for
  confirmation; it is hidden when the account is archived.

**Providers** have a **per-bill history** at `<ui>/bills/:billId/history`, reached from the bill
row (`provider-bills/:id/bill-payments.json`). It lists only that bill's payments and skips, with
the same badges and Undo. The page has a back link to the provider and a header
`<description> — <provider name>` with the kind badge (and the expected amount with its
frequency for recurring bills). Undo is hidden on an archived provider, whose history stays
readable. For paid provider-bill payments, the Undo confirmation always warns that the recorded
charge may already have been sent to the accountant.

## Add / edit bill

`<ui>/bills/new` (optionally `?provider=:id`), `<ui>/bills/:billId/edit`; `<ui>/bills` redirects to
the Providers list.

- A **Kind** selector (One-off / Recurring; a new form starts on One-off), **disabled on edit**:
  `kind` is never sent on a PATCH. The provider select is also disabled when editing a recurring
  bill (a recurring bill never moves to another provider).
- **One-off** fields: provider (the owner's non-archived provider-expense accounts), paying
  account (the owner's non-archived `regular` accounts in the provider's currency, refreshed when
  the provider changes, **required on create and edit**), due date (past allowed, defaulting to
  the local today), amount, description, notes.
- **Recurring** fields: provider, description, expected amount (optional), frequency (monthly by
  default), due day, due month (yearly only), bills from (filled with today when a due day is
  first entered), **Show in calendar** (on by default) and default paying account (optional).
- Next to *Show in calendar* the form says "Untick to stop this bill. Its payment history is
  kept.": there is no per-bill archiving yet (*Archive an individual provider bill*,
  [#141](https://github.com/darthjee/ward/issues/141)).
- **Server errors** — `PROVIDER_BILL_NAME_TAKEN` on the description, `CURRENCY_MISMATCH` and
  `ACCOUNT_NOT_FOUND` on the paying account; `PROVIDER_BILL_LIMIT`, `ACCOUNT_ARCHIVED`,
  `PROVIDER_BILL_KIND_LOCKED`, `PROVIDER_BILL_PROVIDER_LOCKED`, `PROVIDER_BILL_PAID` and
  `BILL_PAID` ("undo the payment first") in the form alert. A 422 never reveals more than the
  server says; a 404 (including a bill of an archived provider) renders Not found.
- **Delete** asks for confirmation.
- Save, cancel and delete return to the provider's detail page (or the Providers list).
- An unavailable `?provider=` (unknown, archived, other owner) is silently dropped from the
  preselect.

## Calendar

The Calendar lists the occurrences of debts, providers and one-off bills
([#77](https://github.com/darthjee/ward/issues/77)):

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
- **Entry** — the label is `<source_bill.description> / <provider name>` for provider bills, so
  three bills of one provider read "Internet / Vivo", "Telefone / Vivo", "Móvel / Vivo"; a debt
  shows its account name. Then the expected amount (or none), the effective date plus the
  nominal one when the weekend shift moved it ("due Sat 14, moved to Mon 16"), and the status.
  It links to the debt / provider detail page, or to the one-off bill's edit page.
- **Pay** dialog (open / overdue) — amount (pre-filled from the expected amount, required; empty
  when there is none), paid on (default today, not after today), paying account (pre-filled from
  the default, required when that is null or archived), and **Also record the charge** for
  `provider_bill` and `bill` entries, on by default. Pay, Skip and Undo target the per-bill route
  (`provider-bills/:id/occurrences/:dueDate/payment.json`) for provider bills,
  `bills/:id/payment.json` for one-off `bill` entries, and the account route for debts. A 409
  reloads the entry.
- **Skip** (open / overdue) and **Undo** (paid / skipped) ask for confirmation.

Decisions:

- Weeks start on **Monday** (ISO) for the Upcoming groups and for the month grid, regardless of
  the display locale.
- Below the `md` breakpoint the month view is an **agenda** list of only the days that have
  entries; the grid is shown from `md` up.
- List-view totals show `open` (Overdue from `overdue.json`, Upcoming from `calendar.json`); the
  month view shows `expected` / `paid` / `open`. Totals are never summed across currencies.
- "Today" is the browser's local date. Upcoming covers `[today, today + 59]`; Overdue uses the
  server's UTC today. Upcoming drops the occurrences already listed in Overdue (same kind,
  source account, bill and nominal date).
- A 409 on Pay or Skip (and a 404 / `ACCOUNT_ARCHIVED` on Undo) reloads the view's data; so does
  every successful Pay, Skip or Undo.
- The paying account defaults to `default_paying_account` only when it is among the offered
  non-archived accounts of the entry's currency; otherwise it starts empty and is required.
- The context switch from either calendar page lands on the Calendar list.

Deferred: one view across Personal and every organization, *Combined calendar across owners*
([#101](https://github.com/darthjee/ward/issues/101)); subscribing from an external calendar
app, *Calendar feed (iCal / `.ics`)* ([#102](https://github.com/darthjee/ward/issues/102)).

## Differences from the original spec

- **Paid on** may not be after the browser's local today, while the server accepts up to the
  UTC today plus one day.
- The **Also record the charge** box is shown for provider and one-off bill entries (the server
  rejects `record_charge` for debts).
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
- **Calendar label** — one combined `<bill> / <provider>` link text, not separately styled primary
  and secondary labels (split-provider spec, [#124](https://github.com/darthjee/ward/issues/124)).
- **Pay amount** is required on every entry, not only when the expected amount is `null`.
- **Provider bills** — the per-bill history page has a header and a back link; the Bills block
  shows the expected amount on one-off rows too and is paginated; a refused delete gets a
  kind-specific message; the provider select is locked when editing a recurring bill; Add bill
  also appears in the shortcut bar.
- **Stale remembered context** is checked against the loaded `/orgs.json` list (no 404
  request), and only at the entry hash; a direct stale URL renders `NotFound` with "Go to
  Personal".
- **The accountant CSV** uses CRLF line endings.
