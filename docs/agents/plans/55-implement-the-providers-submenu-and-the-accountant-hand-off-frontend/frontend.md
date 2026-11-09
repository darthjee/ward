# Frontend Plan: Implement the Providers submenu and the accountant hand-off

Main plan: [plan.md](plan.md)

## Overview

Build the Providers submenu and the accountant hand-off page under `frontend/`, both contexts
(`/bank/...` and `/orgs/:orgId/bank/...`). Reuse `bank/common` and parameterise it where needed:
the ledger row slot, confirm kinds, the branch / account-number renderer, a checkbox field, an
amount sum and the list header link slot. Do not copy shared code. Every Accounts, Debts and
Investments spec must keep passing.

## Context

- Specs (source of truth):
  - `docs/agents/specs/banking/accounts/provider-expense.md`: *Recording charges and payments*,
    *Business expenses for the accountant*, *Providers submenu UI*, *Performance & security* 1–2,
    *Edge cases* 1, 4–5, 8–11, *Required tests* (UI).
  - `docs/agents/specs/banking/ui/menu.md` (the Providers row).
  - `docs/agents/backend/routes/bank.md` (*Accountant hand-off*).
- The issue's "Decisions on points the spec leaves open" section is binding. It covers:
  - shortcut mapping;
  - frequency display;
  - sent marks and the warnings;
  - hand-off range, loading, gate and success message;
  - per-currency totals;
  - the CSV header row.
- API contract (backend is already merged, #54 / #71). All paths go through
  `contextPath(context, …)`:
  - `GET /bank/accounts.json?type=provider_expense&archived=…`. Each row carries
    `provider_expense`: `for_accountant`, `provider_tax_id`, `expected_amount` (decimal string),
    `charge_frequency` (`monthly`|`yearly`), `due_day`, `due_month`, with `null` when unset.
  - `POST /bank/accounts.json` with `{ type: "provider_expense", …common, provider_expense: {…} }`.
  - `PATCH /bank/accounts/:id.json` with the changed fields plus a partial `provider_expense`.
    It never sends `type`, and `null` clears an optional field. `charge_frequency` and
    `for_accountant` are never `null`.
  - Ledger rows of charges carry `sent_to_accountant_at` (an ISO timestamp or `null`). The key is
    absent on payments, on the opening row and on other types.
  - `GET /bank/accountant/charges.json?from=YYYY-MM-DD&to=YYYY-MM-DD&include_sent=true|false`
    replies `{ charges: [{ id, date, description, amount, sent_to_accountant_at, account: { id,
    name, bank_name, provider_tax_id, currency } }] }`. On 400 it returns `VALIDATION_FAILED`
    (future date, > 366 days, > 1000 rows, from > to).
  - `POST /bank/accountant/mark-sent.json` and `/mark-unsent.json` with body
    `{ transaction_ids: [..] }` reply `200 { charges: [{ id, sent_to_accountant_at }] }`. Errors
    are 400 or 404.

## Steps

- [01 — Parameterise shared bank/common pieces](frontend/01-parameterise-bank-common.md)
- [02 — Add provider and accountant client calls](frontend/02-client-calls.md)
- [03 — Register the Providers section, routes and menu entry](frontend/03-register-section-routes-menu.md)
- [04 — Providers list page](frontend/04-list-page.md)
- [05 — Provider create and edit pages](frontend/05-form-pages.md)
- [06 — Provider detail page: info block, shortcuts, sent marks and warnings](frontend/06-detail-page.md)
- [07 — Accountant CSV builder and download helper](frontend/07-csv-builder.md)
- [08 — Accountant hand-off page](frontend/08-accountant-page.md)
- [09 — Record the #55 decisions in the spec](frontend/09-spec-docs.md)

## CI Checks

- `frontend`: `docker-compose run --rm ward_fe yarn coverage` (or `yarn test`) (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

Never run `yarn` on the host. Always go through the `ward_fe` service.

## Notes

- **Lint limits.** `max-lines` 300, `complexity` 10 and `max-depth` 4 are treated as hard limits.
  Splits are already needed:
  - `client/BankClient.js` is at 295 lines, so it must be split (step 02).
  - `amounts.js` (212), `AccountDetailHelper.jsx` (164) and `LedgerTableHelper.jsx` (137) grow
    in step 01. Watch them.
- **Escaping.** Names, provider, notes and descriptions are rendered through JSX, so they are
  escaped. Never use `dangerouslySetInnerHTML`.
- **Specs run in Node without a DOM.** The Blob / anchor download must be an injectable module
  (step 07) that is faked in the page specs, for example with `specs/support/fakeWindow.js`.
- **Security / cache review.** No new endpoints and no proxy changes, so `security` and `cache`
  review are not strictly required. The new client calls only consume existing `user-scoped` /
  `never` routes.
- **Docs ownership.** Step 09 edits `docs/agents/specs/...`, which is in the architect's scope.
  The issue asks for it in the same PR, so the architect (or the frontend agent under the
  architect's direction) does it. Record only decisions, not implementation detail.
