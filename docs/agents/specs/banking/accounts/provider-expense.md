# Provider-expense accounts

> **Owned by [#32](https://github.com/darthjee/ward/issues/32).** Skeleton written by
> [#27](https://github.com/darthjee/ward/issues/27): it records only what is already decided.

## Decisions

- A provider-expense account is an `Account` with `type` `provider_expense` (see
  [README.md](README.md)).
- It inherits the owner from its account.
- It covers **business expenses for the accountant**.
- Provider-expense accounts are **not** shown in the main accounts list; they are seen in their
  own place in the Bank menu (see [ui/menu.md](../ui/menu.md)).

## Open questions

- [ ] Whether provider-expense and debt accounts share one submenu or get one each
  ([ui/menu.md](../ui/menu.md), with #30).
- [ ] Whether provider-expense accounts generate bills ([bills.md](../bills.md), with
  [#33](https://github.com/darthjee/ward/issues/33)).
- [ ] How expenses are collected and handed to the accountant.
- [ ] Fields specific to provider-expense accounts.
- [ ] Routes, permissions and cache class for provider-expense accounts.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Owning sub-issue: https://github.com/darthjee/ward/issues/32

## Required tests

TBD — defined by #32
