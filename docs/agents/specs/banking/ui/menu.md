# Bank menu

> Owned by [#27](https://github.com/darthjee/ward/issues/27). The submenu table below is shared:
> **each sub-issue edits only its own row.**

## Decisions

The **Bank** menu has these entries:

| Submenu | Shows | Status | Row owner |
|---|---|---|---|
| **Accounts** | `regular` accounts only: list, detail (with the ledger), create / edit pages ([accounts/regular.md](../accounts/regular.md#accounts-submenu-ui)) | Specified | [#29](https://github.com/darthjee/ward/issues/29) |
| **Debt accounts** | `debt` accounts ([accounts/debt.md](../accounts/debt.md)) | Place decided; shared with provider-expense or not is open | [#30](https://github.com/darthjee/ward/issues/30) |
| **Provider-expense accounts** | `provider_expense` accounts ([accounts/provider-expense.md](../accounts/provider-expense.md)) | Place decided; shared with debt or not is open | [#32](https://github.com/darthjee/ward/issues/32) |
| **Calendar** | Upcoming bills ([calendar.md](calendar.md)) | Decided | [#33](https://github.com/darthjee/ward/issues/33) |

Where investment accounts are shown depends on
[accounts/investment.md](../accounts/investment.md) ([#31](https://github.com/darthjee/ward/issues/31)),
which adds its own row if they get one.

## Open questions

- [ ] One shared submenu for debt and provider-expense accounts, or one each (#30 / #32). If
  shared, #30 and #32 merge their two rows into one.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- This sub-issue: https://github.com/darthjee/ward/issues/27

## Required tests

- The Bank menu shows the **Accounts** and **Calendar** entries and a place for debt /
  provider-expense accounts.
- The **Accounts** entry lists `regular` accounts only.
- The tests for each row's content are defined by that row's owning sub-issue.
