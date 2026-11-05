# Regular accounts

> **Owned by [#29](https://github.com/darthjee/ward/issues/29).** Skeleton written by
> [#27](https://github.com/darthjee/ward/issues/27): it records only what is already decided.

## Decisions

- A regular account is an `Account` with `type` `regular` (see [README.md](README.md)).
- It belongs to an organization.
- Regular accounts are the only ones shown in the main accounts list.
- This file also defines the **fields common to every account type**.

## Open questions

- [ ] The common field set shared by every account type.
- [ ] Currency handling (one currency per account, per organization, or multi-currency).
- [ ] Categories.
- [ ] Routes, permissions and cache class for regular accounts.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Owning sub-issue: https://github.com/darthjee/ward/issues/29

## Required tests

TBD — defined by #29
