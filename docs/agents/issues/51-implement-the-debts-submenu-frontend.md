# Issue: Implement the Debts submenu — frontend

## Description

Implement the **Debts** submenu in the frontend.

Part of Epic #26. The specs under `docs/agents/specs/` are the source of truth: build against them and do not re-decide anything they settle. When a spec is unclear or wrong, raise it on the issue instead of deviating silently.

### Specs

- `docs/agents/specs/banking/accounts/debt.md`: *Recording payments* (UI shortcuts), *Debts submenu UI*, *Edge cases* 6–7, *Required tests* (frontend)
- `docs/agents/specs/banking/ui/menu.md` (the **Debts** row)

### Scope

- The **Debts** entry in the Bank menu (`BANK_MENU_ENTRIES`), its routes (`ROUTES_CONTEXT`: `/bank/debts`, `/bank/debts/new`, `/bank/debts/:accountId/edit`, `/bank/debts/:accountId`) and its section row (`SECTIONS_CONTEXT`), so that switching context from a debts page lands on the Debts list.
- List, detail (debt info block, ledger, **Add payment** / **Add interest** shortcuts) and create / edit pages as specified, in both contexts.
- The client calls for `GET /accounts.json?type=debt`, and for create / PATCH with `type: "debt"` and the nested `debt` object.
- The wrong-type deep-link redirects in both directions, including the Accounts side: a debt opened under `<ui>/accounts/:id` goes to `<ui>/debts/:id`.
- The shortcuts map onto the existing inline form's **In / Out** toggle: **Add payment** = In, "Payment", with `instalment_amount` suggested when set; **Add interest** = Out, "Interest", amount empty.

### Decisions on points the spec leaves open

- **Shared code with the Accounts submenu.** Extract the parts the debt pages share with #49's Accounts pages into `bank/common`, or parameterise them, and build `bank/debts` on top of them. These parts are the ledger, the inline transaction form, the header / archive actions and the common form fields. Don't copy them. The Accounts pages move to the shared parts, and their existing specs must keep passing.
- **Clearing the interest rate.** Emptying the rate on the create / edit form hides the period, and the request sends `interest_rate: null` and `interest_period: null` together, which is how `debt.md` clears a rate. Once a rate is entered, the period is required on the client.

### Depends on

- #49 (Bank menu and Accounts submenu — frontend).
- #50 (debt accounts — backend).

### Acceptance criteria

- The frontend *Required tests* of `debt.md` are covered by Jasmine specs, and they pass.
- The Accounts submenu's existing specs still pass after the shared-code extraction.
- Lint passes.
