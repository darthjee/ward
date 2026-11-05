# Debt accounts

> **Owned by [#30](https://github.com/darthjee/ward/issues/30).** Skeleton written by
> [#27](https://github.com/darthjee/ward/issues/27): it records only what is already decided.

## Decisions

- A debt account is an `Account` with `type` `debt` (see [README.md](README.md)).
- It belongs to an organization.
- Debt accounts are **not** shown in the main accounts list; they are seen in their own place in
  the Bank menu (see [ui/menu.md](../ui/menu.md)).

## Open questions

- [ ] Whether debt and provider-expense accounts share one submenu or get one each
  ([ui/menu.md](../ui/menu.md), with #32).
- [ ] Whether debts generate bills ([bills.md](../bills.md), with
  [#33](https://github.com/darthjee/ward/issues/33)).
- [ ] Fields specific to debt accounts.
- [ ] Routes, permissions and cache class for debt accounts.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Owning sub-issue: https://github.com/darthjee/ward/issues/30

## Required tests

TBD — defined by #30
