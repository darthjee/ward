# Frontend Plan: Implement the Debts submenu — frontend

Main plan: [plan.md](plan.md)

## Overview
Build the Debts submenu (`<ui>/debts…`, both contexts) against
`docs/agents/specs/banking/accounts/debt.md` (*Recording payments*, *Debts submenu UI*, edge
cases 6–7, frontend *Required tests*) and the **Debts** row of
`docs/agents/specs/banking/ui/menu.md`. The shared Accounts code from #49 is extracted into
`frontend/assets/js/components/resources/bank/common/` (or parameterised) first, and the
Accounts pages are moved onto it with their specs still passing.

## Context
- Paths below are relative to `frontend/assets/js/` unless they start with `frontend/` or
  `docs/`. Specs mirror sources under `frontend/specs/assets/js/`.
- #49 put the Accounts submenu in `components/resources/bank/accounts/pages/` (pages,
  `controllers/`, `helpers/`, `hooks/`). `components/resources/bank/common/` already exists
  (`amounts.js`, `BankErrorAlert`, `ConfirmModal`, `CurrencySelect`, `currentHash.js`,
  `pageQuery.js`, `runLoad.js`, …).
- Menu: `BANK_MENU_ENTRIES` in
  `components/common/header/bankMenu/helpers/BankMenuHelper.jsx`. Routes and sections:
  `ROUTES_CONTEXT` / `SECTIONS_CONTEXT` in `utils/routing/routes.js`; page keys map to
  components in `components/helpers/AppHelper.jsx`.
- Client: `client/BankClient.js`. `listAccounts` hardcodes `type=regular`; bodies go through
  `whitelist(attrs, ACCOUNT_FIELDS)` + `pickDefined` (keeps `null`, drops `undefined`); `type`
  and `debt` are currently stripped and `BankClientSpec` asserts that for the existing calls.
- API contract (backend #50, already merged): generic routes
  `GET <base>/accounts.json?type=debt&archived=…`, `POST <base>/accounts.json` with
  `type: "debt"` and optional `debt: {…}`, `GET/PATCH <base>/accounts/:id.json` (PATCH merges
  `debt` partially, `type` immutable, archived → only `name`). The `debt` object is snake_case:
  `interest_rate` (decimal string, no trailing zeros), `interest_period`
  (`monthly`|`yearly`), `instalment_amount` (decimal string), `instalment_frequency`
  (`monthly`|`yearly`), `due_day`, `due_month`, `instalment_count`; unset fields `null`.
  Responses carry `type`.
- Decisions from the issue (do not re-decide): shared code goes to `bank/common` / is
  parameterised, not copied; emptying the rate hides the period and sends
  `interest_rate: null` + `interest_period: null` together; once a rate is entered the period
  is required on the client.

## Steps

- [01 — Extract the ledger and detail plumbing into bank/common](frontend/01-extract-ledger-and-detail.md)
- [02 — Extract the header and common form parts into bank/common](frontend/02-extract-header-and-form.md)
- [03 — Client calls for debt accounts](frontend/03-client-debt-calls.md)
- [04 — Menu entry, routes, sections and page keys](frontend/04-menu-routes-sections.md)
- [05 — Debts list page](frontend/05-debts-list.md)
- [06 — Debt detail page with info block and shortcuts](frontend/06-debt-detail.md)
- [07 — Debt create / edit pages](frontend/07-debt-create-edit.md)
- [08 — Wrong-type deep-link redirects](frontend/08-wrong-type-redirects.md)

## CI Checks
- `frontend`: `docker-compose run --rm ward_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)
- Quicker local loop: `docker-compose run --rm ward_fe yarn test`

## Notes
- Never run `yarn` on the host — always through `docker-compose run --rm ward_fe …`.
- Steps 01–02 are pure refactors: run the full suite after each and keep every existing
  Accounts spec passing unchanged in behaviour (spec files may move/rename imports along with
  the sources they cover).
- The spec's `/accounts.json` is shorthand for the context-prefixed
  `/bank/accounts.json` / `/orgs/:orgId/bank/accounts.json` built by `contextPath`.
- Rate display needs a small new helper (no percent formatter exists): show the stored
  decimal string as-is with `%` and the period (e.g. "1.99% / month"); the list's instalment
  column uses `formatMoney` + frequency (e.g. "500,00 / month").
- Shortcut preset semantics (open question settled here): applying a preset when the inline
  form is dirty or editing goes through the existing `canDiscard()` confirmation; the preset
  becomes the new `baseline`, so Cancel right after a shortcut does not prompt.
- Names, creditor, notes and descriptions must be rendered as text (React escaping) — never
  `dangerouslySetInnerHTML`; add an escaping assertion per spec requirement.
- If any spec point turns out unclear or wrong while implementing, raise it on issue #51
  instead of deviating.
