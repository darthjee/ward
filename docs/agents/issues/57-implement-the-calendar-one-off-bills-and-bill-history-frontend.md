# Issue: Implement bill inputs, one-off bills and Bill history — frontend

## Description

Implement, in the frontend, the **bill inputs** on the Debts / Providers forms, the **one-off bill
pages** and the **Bill history** list on the debt / provider detail pages. The Calendar views
themselves (list and month views, with Pay / Skip / Undo) are split out to #77, which builds
on this issue.

Part of Epic #26. The specs under `docs/agents/specs/` are the source of truth: build against them and do not re-decide anything they settle. When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

## Specs

- `docs/agents/specs/banking/ui/calendar.md`: *Add / edit bill*, *Changes to the Debts /
  Providers pages*, *Security in the UI*, and the matching *Required tests* (Add / edit bill,
  Debts / Providers forms, Bill history, escaped rendering)
- `docs/agents/specs/banking/bills.md`: *Schedule fields on source accounts*, *One-off bills*,
  *Routes and permissions*, and the decisions marked "(decided in #56)"
- `docs/agents/backend/routes/bank.md`: *Bills and calendar* (the routes, bodies, responses and
  errors as built by #56)

## Scope

- **Debts / Providers forms** (create and edit): three new inputs.
  - **Bills from** (date): filled with today when a due day is first entered.
  - **Show in Calendar** (checkbox): on by default.
  - **Default paying account** (select, optional): lists the owner's non-archived `regular`
    accounts in the account's currency.
  - The detail pages show the three values.
- **One-off bill pages**: `<ui>/bills/new` and `<ui>/bills/:id/edit`.
  - The fields and limits follow *One-off bills*: provider, paying account, due date (past
    dates allowed), amount, description and notes.
  - `?provider=:id` pre-selects the provider.
  - The provider select lists the non-archived provider-expense accounts.
  - The paying-account select is filtered by the provider's currency and refreshed when the
    provider changes.
  - Server `422` and `409 BILL_PAID` errors are shown on the form.
  - **Delete** asks for confirmation; on a paid bill, the `409` tells the user to undo the
    payment first.
  - The routes are registered in the frontend router and in the Bank menu's active-prefix
    table, under both `/bank` and `/orgs/:orgId/bank`.
- **Add bill** button on the provider detail page, opening `<ui>/bills/new?provider=:id`.
- **Bill history** on the debt and provider detail pages.
  - Data: `<base>/accounts/:accountId/bill-payments.json`, newest first, paginated like the
    ledger (`BankPagination`).
  - Each row shows the status (paid / skipped), the due date, the paid-on date, the amount, the
    paying account and, for one-off rows, the bill's description.
  - **Off-schedule** rows are marked as such.
  - Each row has an **Undo** action: `DELETE …/occurrences/:dueDate/payment.json` for derived
    rows, `DELETE …/bills/:id/payment.json` for one-off rows. It asks for confirmation, then
    reloads the list.
- A shared **Undo** confirmation component, reused by the Calendar in #77.

## Decisions (points the spec leaves open)

- **Undo on archived accounts.** The Bill history stays readable on an archived account, but no
  Undo buttons are shown while the account is archived. The backend would reject the undo
  anyway (`409 ACCOUNT_ARCHIVED` for a paid row, `404` for a skip), and this matches how
  archived ledgers block edits.
- **Undo confirmation text.** The confirmation says that undoing deletes the transactions the
  payment created, **including a charge already sent to the accountant**. #56 decided that
  undo deletes a sent charge and left the warning to the frontend. The occurrence payment does
  not say whether the charge was sent, so the warning is always shown for paid provider and
  one-off rows.
- **Errors on Undo.** A `404` (already undone elsewhere) or `409` reloads the list and shows the
  error alert.
- **"Today"** is the browser's local date (`localToday`), like the existing ledger forms.

## Out of scope

- The Calendar submenu, its list and month views, and the Pay / Skip actions: #77.
- A page listing one-off bills: the spec defines none. Unpaid one-off bills appear in the
  Calendar.

## Depends on

- #51 (Debts submenu — frontend), #55 (Providers submenu — frontend) and #56 (bills and the
  calendar — backend), all merged.

## Acceptance criteria

- The *Required tests* of `ui/calendar.md` that fall in this scope (Add / edit bill, Debts /
  Providers forms, Bill history, escaped rendering) are covered by Jasmine specs, and they pass.
- The decisions above are covered by specs: Undo hidden on archived accounts, the sent-charge
  warning, and the derived and one-off Undo routes.
- The existing frontend specs still pass, and lint passes.
