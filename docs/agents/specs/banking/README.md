# Banking specs

> **Naming:** the spec folder is `banking`; the backend module is `bank`.

Feature specs for the **`bank` module** — Epic [#26](https://github.com/darthjee/ward/issues/26).
While this folder exists it is the source of truth for every bank decision; the sub-issues of #26
read it instead of deciding on their own. See [specs.md](../../specs.md) for the spec lifecycle.

## Purpose and scope

`bank` is Ward's first domain module (lazy tier). It tracks:

- bank accounts;
- business expenses, kept for the accountant;
- bills to pay.

All bank data is scoped to **organizations**. Organizations belong to the `auth` module and are
specified in [specs/auth/](../auth/README.md) — a dependency that is implemented before any bank
entity.

## Decisions

- **`Account`** is the bank entity for every kind of account, with a `type`: `regular`, `debt`,
  `investment` or `provider_expense` (see [accounts/README.md](accounts/README.md)).
- **The main accounts list shows `regular` accounts only.** Debt and provider-expense accounts
  are seen in their own place.
- **The Bank menu** has **Accounts** (regular only), a place for **debt / provider-expense
  accounts** (the exact split is decided later) and a **Calendar** of upcoming bills (see
  [ui/menu.md](ui/menu.md)).
- **Bank data is scoped to organizations.** This changes the "every domain record belongs to
  exactly one user" rule in `product.md`. The change is only **announced** here:
  [#28](https://github.com/darthjee/ward/issues/28) specifies it in
  [auth/organizations.md](../auth/organizations.md), and the fold issue of #26 applies it.
- **No separate `api/` or `security.md` yet.** Each concern file holds its own routes,
  permissions and cache class; they can be split out later.

## Index

| File | Concern |
|---|---|
| [accounts/README.md](accounts/README.md) | `Account` and its `type`, common concepts, main-list rule |
| [accounts/regular.md](accounts/regular.md) | Regular accounts and the common account fields |
| [accounts/transactions.md](accounts/transactions.md) | Ledger and balances |
| [accounts/debt.md](accounts/debt.md) | Debt accounts |
| [accounts/investment.md](accounts/investment.md) | Investment accounts |
| [accounts/provider-expense.md](accounts/provider-expense.md) | Provider-expense accounts, incl. business expenses for the accountant |
| [bills.md](bills.md) | Bill entity, recurrence, paying |
| [ui/menu.md](ui/menu.md) | Bank menu and its submenus |
| [ui/calendar.md](ui/calendar.md) | Calendar of upcoming bills |

## Sub-issue map

| Sub-issue | Files |
|---|---|
| [#27](https://github.com/darthjee/ward/issues/27) | this `README.md`, `accounts/README.md`, `ui/menu.md` (each sub-issue edits only its own row), the skeletons of every other file |
| [#28](https://github.com/darthjee/ward/issues/28) | [auth/organizations.md](../auth/organizations.md) |
| [#29](https://github.com/darthjee/ward/issues/29) | `accounts/regular.md`, `accounts/transactions.md` |
| [#30](https://github.com/darthjee/ward/issues/30) | `accounts/debt.md` |
| [#31](https://github.com/darthjee/ward/issues/31) | `accounts/investment.md` |
| [#32](https://github.com/darthjee/ward/issues/32) | `accounts/provider-expense.md` |
| [#33](https://github.com/darthjee/ward/issues/33) | `bills.md`, `ui/calendar.md` |
| Implementation / fold / remove sub-issues of #26 (created later by the *Continue* split) | build against this folder; the fold handles both `specs/banking/` and `specs/auth/`, then they are removed |

## Implementation order

Rough order, refined when the implementation sub-issues are created:

1. Organizations ([specs/auth/](../auth/README.md)).
2. Accounts and their types.
3. Bills and the calendar.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Sub-issues: https://github.com/darthjee/ward/issues/27,
  https://github.com/darthjee/ward/issues/28, https://github.com/darthjee/ward/issues/29,
  https://github.com/darthjee/ward/issues/30, https://github.com/darthjee/ward/issues/31,
  https://github.com/darthjee/ward/issues/32, https://github.com/darthjee/ward/issues/33
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md
- Product decisions (`bank` module, data ownership): https://github.com/darthjee/ward/blob/main/docs/agents/product.md

## Required tests

None for this index; the tests are defined in each file listed in the [index](#index).
