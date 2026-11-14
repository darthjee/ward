# Frontend Plan: Implement the Calendar views — frontend

Main plan: [plan.md](plan.md)

Issue: [77-implement-the-calendar-views-frontend.md](../../issues/77-implement-the-calendar-views-frontend.md)

## Overview
Add the Calendar list view, the month view, the calendar entry and the Pay / Skip / Undo actions
under `assets/js/components/resources/bank/calendar/`. Wire them into the router, the section
registry and the Bank menu, under both `/bank` and `/orgs/:orgId/bank`. Every rule comes from
`docs/agents/modules/bank/ui.md` (*Calendar*), `docs/agents/modules/bank/bills.md` and
`docs/agents/backend/routes/bank.md` (*Bills and calendar*). Do not re-decide anything those
docs settle.

## Context
- The backend routes exist (#56). `<base>` is `/bank` or `/orgs/:orgId/bank`, built with
  `contextPath(context, ...)`:
  - `GET <base>/calendar.json?from=&to=` returns `{ occurrences, totals }`, and each total is
    `{currency, expected, paid, open}`;
  - `GET <base>/calendar/overdue.json` returns `{ occurrences, totals }`, oldest first, and each
    total is `{currency, open}`;
  - `POST` / `DELETE <base>/accounts/:accountId/occurrences/:nominalDate/payment.json`, for
    derived (debt / provider) entries;
  - `POST` / `DELETE <base>/bills/:id/payment.json`, for one-off entries (`kind: bill`).
- Occurrence shape:

  ```
  { kind: debt|provider|bill,
    source_account: {id, name, type},
    bill: {id, description, ...} | null,
    nominal_date, effective_date,
    expected_amount | null,
    currency,
    status: open|overdue|paid|skipped,
    payment,
    default_paying_account: {id, name} | null }
  ```

- Payment body:
  - Pay: `{status:'paid', paid_on, amount, paying_account_id, record_charge}`.
  - `record_charge` is sent **only** for the `provider` and `bill` kinds. Sending it for a debt
    gets a 400.
  - Skip: exactly `{status:'skipped'}`.
  - Errors: `409 OCCURRENCE_ALREADY_PAID` on pay; `409 ACCOUNT_ARCHIVED` and `404` on undo.
- Pieces from earlier issues to reuse:
  - from #57: `UndoPaymentConfirm` and `undoWarnsCharge`, `ConfirmModal`, `usePayingAccounts`,
    `payingAccountOptions`, `classifyError`, `BankErrorAlert`, `runLoad`, and the
    `currentHash` / `navigate` helpers; `BillHistoryController` is the template for the error
    handling;
  - from #65: `formatMoney`, `formatDate` and `localToday`.
- Spec conventions:
  - the static render (`renderedOutput`) runs no effects, so hooks export pure builders and
    controllers are classes with injectable `client` and setters;
  - client specs use `fetchSequence` and loop over a `CONTEXTS` table.

## Steps

- [01 — Calendar date helpers](frontend/01-calendar-date-helpers.md)
- [02 — Calendar and payment client calls](frontend/02-calendar-client.md)
- [03 — Calendar entry and totals components](frontend/03-entry-and-totals.md)
- [04 — Pay dialog, Skip and Undo actions](frontend/04-pay-skip-undo.md)
- [05 — List view page](frontend/05-list-view.md)
- [06 — Month view page](frontend/06-month-view.md)
- [07 — Routing, section registry and Bank menu](frontend/07-routing-and-menu.md)
- [08 — Documentation update](frontend/08-docs.md)

## CI Checks
- `frontend`: `docker-compose run --rm ward_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- **No single-occurrence GET exists.** "A 409 reloads the entry" means re-fetching the view's
  data: `calendar.json` in the month view, and `calendar.json` + `overdue.json` in the list
  view. The same refresh runs after every successful Pay, Skip or Undo.
- **`default_paying_account` has no archived flag.** It counts as "archived or unusable" when
  its id is not among `payingAccountOptions(usePayingAccounts(context), occ.currency)`. In that
  case, or when it is `null`, the field starts empty and is required.
- **The path date is the nominal date.** Derived entries use `source_account.id` and
  `nominal_date`, never `effective_date`.
- **Day-boundary overlap.** Upcoming starts at the local today, while the server computes
  `overdue` on the UTC today. An occurrence returned by both requests could show twice.
  - Decision: Upcoming drops any occurrence already listed in Overdue. Two occurrences match
    when they have the same kind, `source_account.id`, `bill?.id` and `nominal_date`.
  - The gap case (an entry that is in neither list for a few hours) is accepted, as the issue
    says: "Overdue comes from the server".
  - Totals are shown exactly as the server returns them.
- **Escaping.** Occurrences carry no `notes`, only `source_account.name` and
  `bill.description`. Render them as React text, never with `dangerouslySetInnerHTML`, and
  assert `&lt;script&gt;` in specs.
- **Paid on.** The UI rule is "not after the local today" (`isAfterLocalToday`), even though the
  server accepts up to UTC today + 1 day.
- Keep every file under the ESLint size limits (300 lines). Split the helpers per section, as
  the other bank pages do.
- **No backend change.** All calendar routes are `user-scoped` or `never`, so there is nothing
  to add to Navi. Cache and security reviews are not required: no new endpoint, no proxy rule
  and no auth change.
