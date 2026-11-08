# Issue: Implement the Investments submenu — frontend

## Description

Implement the **Investments** submenu in the frontend.

Part of Epic #26. The specs under `docs/agents/specs/` are the source of truth: build against them and do not re-decide anything they settle. When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

### Specs

- `docs/agents/specs/banking/accounts/investment.md`: *Recording movements* (UI shortcuts), *Investments submenu UI*, *Edge cases* 4–6 and 10, *Required tests* (frontend)
- `docs/agents/specs/banking/ui/menu.md` (the **Investments** row)

### Scope

- The **Investments** entry in the Bank menu (`BANK_MENU_ENTRIES`), its routes (`ROUTES_CONTEXT`: `/bank/investments`, `/bank/investments/new`, `/bank/investments/:accountId/edit`, `/bank/investments/:accountId`) and its section row (`SECTIONS_CONTEXT`, `sections.js`), so that switching context from an investments page lands on the Investments list.
- List, detail (investment info block, ledger, **Add application** / **Add withdrawal** / **Update value** shortcuts) and create / edit pages as specified, in both contexts.
- The client calls for `GET /accounts.json?type=investment`, and for create / PATCH with `type: "investment"`, the nested `investment` object and `opening_balance: "0"`.
- The wrong-type deep-link redirects in every direction: an investment opened under `<ui>/accounts/:id` or `<ui>/debts/:id` goes to `<ui>/investments/:id`, and a regular or debt account opened under `<ui>/investments/:id` goes to its own path. With the `investment` section registered, `accountTypeGuard` no longer treats `investment` as not found.

### Decisions on points the spec leaves open

- **Shared code.** Build `bank/investments` on the `bank/common` parts #51 extracted: the ledger, the inline transaction form, the header / archive actions, the common form fields, the type guard and the rate formatting (`rates.js`). Don't copy them. Parameterise them where needed (e.g. the "Institution" and "Start date" labels, hiding the opening-balance field). The Accounts and Debts specs must keep passing.
- **Add application / Add withdrawal** map onto the inline form's **In / Out** toggle: **Add application** = In, "Application"; **Add withdrawal** = Out, "Withdrawal". The amount is typed positive in both, and Out stores it negative.
- **Update value** has its own small form with **Current value** (in the account currency) and a date, default today. On submit it computes `current value − account balance`, using the account's `balance` from the detail response. A non-zero difference is posted directly as a "Yield" transaction, positive or negative, and the ledger and balance reload. A difference of `0` posts nothing and shows "Value unchanged". The form is hidden on an archived investment, like the other shortcuts.
- **Clearing the yield rate.** Emptying the rate on the create / edit form hides the period, and the request sends `yield_rate: null` and `yield_period: null` together (edge case 10). Once a rate is entered, the period is required on the client.
- **Kind labels.** `fixed_income` → "Fixed income", `fund` → "Fund", `stocks` → "Stocks", `savings` → "Savings", `pension` → "Pension", `crypto` → "Crypto", `other` → "Other". Liquidity is displayed as "D+N".

### Depends on

- #49 (Bank menu and Accounts submenu — frontend), #51 (Debts submenu — frontend, the `bank/common` extraction).
- #52 (investment accounts — backend).

### Acceptance criteria

- The frontend *Required tests* of `investment.md` are covered by Jasmine specs, and they pass.
- The Accounts and Debts submenus' existing specs still pass.
- Lint passes.
