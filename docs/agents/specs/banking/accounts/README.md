# Accounts

> Owned by [#27](https://github.com/darthjee/ward/issues/27). Each account type has its own file,
> owned by its sub-issue (see the [index](#index)).

## Decisions

- **`Account`** is the single bank entity for every kind of account. It has a `type`:

  | `type` | Meaning | Spec file |
  |---|---|---|
  | `regular` | An everyday bank account | [regular.md](regular.md) |
  | `debt` | A debt being paid off | [debt.md](debt.md) |
  | `investment` | An investment | [investment.md](investment.md) |
  | `provider_expense` | Expenses with a provider, incl. business expenses for the accountant | [provider-expense.md](provider-expense.md) |

- **An account belongs to an organization** (see
  [auth/organizations.md](../../auth/organizations.md)), never directly to a user.
- **The main accounts list shows `regular` accounts only.** Debt and provider-expense accounts
  are seen in their own place (see [ui/menu.md](../ui/menu.md)). Whether investment accounts
  appear in the main list is open ([investment.md](investment.md)).
- Details specific to a type (fields, routes, permissions, cache class) live in that type's file.
  The fields common to every account are defined in [regular.md](regular.md); the ledger and
  balances in [transactions.md](transactions.md).

## Index

| File | Owner |
|---|---|
| [regular.md](regular.md) | [#29](https://github.com/darthjee/ward/issues/29) |
| [transactions.md](transactions.md) | [#29](https://github.com/darthjee/ward/issues/29) |
| [debt.md](debt.md) | [#30](https://github.com/darthjee/ward/issues/30) |
| [investment.md](investment.md) | [#31](https://github.com/darthjee/ward/issues/31) |
| [provider-expense.md](provider-expense.md) | [#32](https://github.com/darthjee/ward/issues/32) |

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- This sub-issue: https://github.com/darthjee/ward/issues/27

## Required tests

None for this index; the tests are defined in each file listed in the [index](#index).
