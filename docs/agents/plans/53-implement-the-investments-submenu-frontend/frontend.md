# Frontend Plan: Implement the Investments submenu — frontend

Main plan: [plan.md](plan.md)

## Overview
Build `assets/js/components/resources/bank/investments/` on top of `bank/common`, and add the
**Investments** entry, routes and section. First, extract into `bank/common` the debt-only code
that investments also need, and parameterise it. The Accounts and Debts specs must keep passing
unchanged in behaviour.

All paths below are relative to `frontend/`. `B` = `assets/js/components/resources/bank`.
Specs mirror sources under `specs/assets/js/...`.

## Context
- Specs (the source of truth): `docs/agents/specs/banking/accounts/investment.md` (*Recording
  movements*, *Investments submenu UI*, *Edge cases* 4–6 and 10, frontend *Required tests*) and
  `docs/agents/specs/banking/ui/menu.md` (the Investments row).
- Backend contract (#52, already merged). The routes are the generic account routes:
  - `GET /accounts.json?type=investment&archived=…` — each row carries `investment`.
  - `POST /accounts.json` with `{type: "investment", …common, opening_balance: "0", investment: {…}}`.
  - `GET /accounts/:id.json` — includes `investment`.
  - `PATCH /accounts/:id.json` — `investment` is merged partially; `null` clears a field; `type`
    is never sent; a non-zero `opening_balance` → 400.
  - The `investment` object (snake_case): `kind`, `yield_rate` (a decimal string), `yield_period`
    (`monthly`/`yearly`), `maturity_date` (`YYYY-MM-DD`), `liquidity_days` (an int from 0 to
    2147483647). Unset fields are `null`.
  - Transactions use the generic routes (`client.createTransaction`).
- Decisions made in the issue:
  - **Add application** = In + "Application"; **Add withdrawal** = Out + "Withdrawal". The
    amount is always typed positive.
  - **Update value** is a separate small form: Current value plus a date (default today). It
    posts `current value − balance` as a "Yield" transaction, or shows "Value unchanged" when
    the difference is 0. It is hidden when the investment is archived.
  - Emptying the rate hides the period and sends `yield_rate: null, yield_period: null`
    together. Once a rate is entered, the period is required.
  - Kind labels: `fixed_income` "Fixed income", `fund` "Fund", `stocks` "Stocks", `savings`
    "Savings", `pension` "Pension", `crypto` "Crypto", `other` "Other". Liquidity is shown as
    "D+N".

## Steps

- [01 — Extract and parameterise shared pieces in bank/common](frontend/01-extract-common.md)
- [02 — Client calls for investments](frontend/02-client.md)
- [03 — Register the Investments section, routes and menu entry](frontend/03-registries.md)
- [04 — Investments list page](frontend/04-list-page.md)
- [05 — Investment create / edit pages](frontend/05-form-pages.md)
- [06 — Investment detail page, info block and shortcuts](frontend/06-detail-page.md)
- [07 — Cross-cutting specs: deep links, contexts, escaping](frontend/07-cross-cutting-specs.md)

## CI Checks
- `frontend`: `docker-compose run --rm ward_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

Never run `yarn` on the host. Always go through `docker-compose run --rm ward_fe`.

## Notes
- **File length.** `assets/js/client/BankClient.js` (262 lines) would pass the 300-line limit
  if a third `xBody` were added. Generalising `debtBody` (step 02) avoids that. Watch the
  length of `BankClientSpec.js` as well; split it by resource if needed.
- **Decimal arithmetic.** The Update value difference must be computed in minor units
  (BigInt), never with floats.
- **Reload access.** The detail slot `renderShortcuts(account, handlers)` gets no page state
  and has no direct `reload`. Step 06 extends `useAccountDetail` to expose them, and keeps the
  existing callers working.
- **"Start date" messages.** `validateAccountFields` hard-codes "Opening date …" error texts.
  Step 01 lets the caller pass the label, so the investment form says "Start date …".
- **Existing assertions to flip.** `sectionsSpec.js` (`investment` not registered) and
  `accountTypeGuardSpec.js` (`investment` → notFound) assert today's behaviour. They become
  redirect cases. This is intended and not a regression.
- **Update value with a pending inline edit.** Update value posts directly and reloads the
  page. If the inline form has unsaved changes, reuse `confirmDiscard` before the reload so
  they are not lost silently.
- **Spec gaps.** If anything in the spec turns out unclear during implementation, raise it on
  the issue rather than deviating silently (the issue requires this).
- **No backend, cache or proxy changes.** No new endpoints: Navi's warm-up and `X-Skip-Cache`
  are unaffected.
