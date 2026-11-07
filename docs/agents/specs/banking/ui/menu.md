# Bank menu

> Owned by [#27](https://github.com/darthjee/ward/issues/27). The submenu table below is shared:
> **each sub-issue edits only its own row.**

## Decisions

The **Bank** menu has these entries:

| Submenu | Shows | Status | Row owner |
|---|---|---|---|
| **Accounts** | `regular` accounts only: list, detail (with the ledger), create / edit pages ([accounts/regular.md](../accounts/regular.md#accounts-submenu-ui)) | Specified | [#29](https://github.com/darthjee/ward/issues/29) |
| **Debts** | `debt` accounts only: list, detail (with the ledger and the Add payment / Add interest shortcuts), create / edit pages ([accounts/debt.md](../accounts/debt.md#debts-submenu-ui)) | Specified | [#30](https://github.com/darthjee/ward/issues/30) |
| **Investments** | `investment` accounts only: list, detail (with the ledger and the Add application / Add withdrawal / Update value shortcuts), create / edit pages ([accounts/investment.md](../accounts/investment.md#investments-submenu-ui)) | Specified | [#31](https://github.com/darthjee/ward/issues/31) |
| **Providers** | `provider_expense` accounts only: list, detail (with the ledger and the Add charge / Add payment shortcuts), create / edit pages, accountant hand-off ([accounts/provider-expense.md](../accounts/provider-expense.md#providers-submenu-ui)) | Specified | [#32](https://github.com/darthjee/ward/issues/32) |
| **Calendar** | Upcoming bills ([calendar.md](calendar.md)) | Decided | [#33](https://github.com/darthjee/ward/issues/33) |

- **Context** — the menu is the same in every context (Personal or an organization); its links
  resolve under the active context's prefix (`/bank/...` or `/orgs/:orgId/bank/...`). The
  context switcher itself is specified in
  [auth/organizations.md](../../auth/organizations.md#active-context).
  - Switching context from a bank page lands on the **same section's list** in the new context
    (Accounts, Debts, Investments or Providers), never on the same record id (which would 404).
  - With zero organizations, the bank menu and pages work fully in Personal.

## Open questions

None.

## Resolved questions

- [x] One shared submenu for debt and provider-expense accounts, or one each (#30 / #32) —
  **one each**: #30 gave debts their own **Debts** submenu and #32 gave provider-expense
  accounts their own **Providers** submenu.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- This sub-issue: https://github.com/darthjee/ward/issues/27
- Providers row (provider-expense accounts): https://github.com/darthjee/ward/issues/32
- Active context and ownership model: https://github.com/darthjee/ward/issues/40,
  https://github.com/darthjee/ward/issues/41

## Required tests

- The Bank menu shows the **Accounts**, **Debts**, **Investments**, **Providers** and
  **Calendar** entries.
- The **Accounts** entry lists `regular` accounts only.
- Menu links are built from the active context, in both Personal and an organization context.
- Switching context from a bank page lands on the same section's list in the new context.
- A user with zero organizations uses the whole bank module in Personal.
- The tests for each row's content are defined by that row's owning sub-issue.
