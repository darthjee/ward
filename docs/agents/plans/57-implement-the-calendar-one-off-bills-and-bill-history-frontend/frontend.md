# Frontend Plan: Implement bill inputs, one-off bills and Bill history

Main plan: [plan.md](plan.md)

## Overview

Build, in `frontend/`, everything issue #57 scopes in: the schedule inputs on the Debts /
Providers forms and detail pages, the one-off bill pages, the Add bill button, the Bill history
list with Undo, and a shared Undo confirmation component. The specs under `docs/agents/specs/`
(`banking/ui/calendar.md`, `banking/bills.md`) and `docs/agents/backend/routes/bank.md` are the
source of truth.

All source paths below are relative to `frontend/assets/js/`; spec paths mirror them under
`frontend/specs/assets/js/` with a `Spec.js` suffix.

## Context

### Backend contracts (built by #56 — consume, do not change)

API base: `/bank` or `/orgs/:orgId/bank`, built with `contextPath(context, '/bank/...')`. Bodies
are strict snake_case (unknown fields → 400). Amounts are decimal strings; dates `YYYY-MM-DD`.

**Schedule fields** — nested inside `debt` / `provider_expense`:

- Request: `bills_from` (`YYYY-MM-DD` | null), `show_in_calendar` (boolean, default `true`),
  `paying_account_id` (positive integer | null).
- Response: `bills_from` (string | null), `show_in_calendar` (bool),
  `paying_account: {id, name} | null` — no raw `paying_account_id`.
- Errors: `422 ACCOUNT_NOT_FOUND` ("account not found"), `422 CURRENCY_MISMATCH`
  ("currency mismatch"), `409 ACCOUNT_ARCHIVED`.

**One-off bills**

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `<base>/bills/:id.json` | 200 bill | 404 (also when the provider is archived) |
| POST | `<base>/bills.json` | 201 bill | 400; 422 `ACCOUNT_NOT_FOUND` / `CURRENCY_MISMATCH` |
| PATCH | `<base>/bills/:id.json` | 200 bill | 400, 404, 422, `409 BILL_PAID` |
| DELETE | `<base>/bills/:id.json` | 204 | 404, `409 BILL_PAID` ("The bill is paid; undo the payment first") |

Body: `provider_account_id`, `paying_account_id`, `due_date`, `amount` (> 0, provider currency,
≤ 10^13 minor units), `description` (trimmed, ≤ 255), `notes` (≤ 2000, nullable). All required
on create except `notes`.

Bill response: `{ id, provider_account:{id,name}, paying_account:{id,name}|null, due_date,
amount, currency, description, notes, payment|null, created_at, updated_at }`.

**Bill history** — `GET <base>/accounts/:accountId/bill-payments.json?page=N` →
`{ payments, pagination: {page, per_page, total_pages, total_count} }`, newest `due_date` first.
Row: `{ id, status: 'paid'|'skipped', paid_on, amount, paying_account:{id,name}|null, due_date,
bill: {id, description}|null, off_schedule: bool }`. Skipped rows have null `paid_on`, `amount`,
`paying_account`. Rows carry no currency — format with the loaded account's `currency`.

**Undo** — derived rows (`bill === null`):
`DELETE <base>/accounts/:accountId/occurrences/:dueDate/payment.json`; one-off rows:
`DELETE <base>/bills/:billId/payment.json`. 204 on success; 404 when no payment; 409
`ACCOUNT_ARCHIVED`.

### Decisions taken in this plan (points neither the issue nor the spec settle)

- **"Bank menu's active-prefix table"**: the Bank menu has no active-prefix logic; the matching
  table is `SECTIONS_CONTEXT` in `utils/routing/routes.js` (where a context switch lands). Add a
  `/bank/bills` row landing on `/bank/providers` (bills belong to providers; there is no bills
  list). #77 may retarget it to the Calendar. Mention this in the PR description.
- **Bill history pagination** keeps its page in component state (not in the hash), so it does
  not clash with the ledger's `?page` hash param. `BankPagination` gets `onNavigate` that
  prevents the default and sets the page.
- **422 handling**: `classifyError` gains a `422 → validation` branch with
  `messages: [error.message]` (no Retry button), shown through `BankErrorAlert` — nothing more
  than the server's message is revealed.
- **After save / delete / cancel on the bill pages**: navigate to the bill's provider detail page
  (`<ui>/providers/:providerId`); Cancel on a new bill without a selected provider goes to the
  providers list.
- **Paying account on the bill form** is required on both create and edit (the form never sends
  `null`, even though PATCH allows it).
- **Add bill** is hidden on archived providers (the server rejects archived providers anyway).
- **Account forms**: when the currency changes on the new page, a selected default paying account
  that no longer matches the currency is cleared.
- **Undo** follows the issue's decisions: hidden while the account is archived; the
  confirmation always warns that a charge already sent to the accountant is deleted too for paid
  provider and paid one-off rows (never for debt rows or skipped rows); a 404 / 409 reloads the
  list and shows the error alert. "Today" is `localToday()`.

## Steps

- [01 — Client layer and 422 classification](frontend/01-client-layer-and-errors.md)
- [02 — Schedule inputs on the Debts / Providers forms](frontend/02-schedule-inputs-on-forms.md)
- [03 — Schedule values on the detail pages](frontend/03-schedule-values-on-detail.md)
- [04 — Shared Undo confirmation and Bill history](frontend/04-undo-confirm-and-bill-history.md)
- [05 — One-off bill pages](frontend/05-one-off-bill-pages.md)
- [06 — Routing, sections and the Add bill button](frontend/06-routing-and-add-bill.md)
- [07 — Escaped rendering specs and final pass](frontend/07-escaping-and-final-pass.md)

## CI Checks

- `frontend`: `docker-compose run --rm ward_fe yarn test` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- Never run `yarn` on the host; always go through `docker-compose run --rm ward_fe`.
- Lint limits: complexity 10, max-lines 300, max-depth 4, JSDoc required.
  `common/detail/helpers/AccountDetailHelper.jsx` is already at ~228 lines — only add a slot
  there; Bill history lives in its own component.
- Existing accounts with `due_day` set and a null `bills_from` have no schedule; the autofill
  only triggers when `bills_from` is blank and a due day is entered, which also covers them on
  edit. No extra hint is added (the spec doesn't ask for one).
- Changing an account's currency on the edit form with a stored default paying account may get a
  `422 CURRENCY_MISMATCH`; it is shown via the 422 validation alert.
- If any decision above conflicts with the spec during implementation, raise it on the issue
  instead of deviating silently.
