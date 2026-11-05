# Organizations

> **Owned by [#28](https://github.com/darthjee/ward/issues/28).** Skeleton written by
> [#27](https://github.com/darthjee/ward/issues/27): it records only what is already decided.
> Everything else is an open question for #28.

## Decisions

- **`Organization`** is a new entity owned by the `auth` module (the same module as `User`).
- **`OrganizationMembership`** links users and organizations many-to-many. Each membership has a
  `role`: `owner`, `admin` or `user`.
- Organization roles are **distinct from Ward's global admin role** (`User.isAdmin` /
  `@AdminOnly()`): being an organization `owner` or `admin` grants nothing outside that
  organization, and being a global admin grants nothing inside an organization.
- **An organization is created automatically for each new user.**

## Data-ownership rule (announced)

`product.md` currently states that every domain record belongs to exactly one user. With
organizations, domain data (starting with the `bank` module) is scoped to **organizations**
instead. #28 specifies the new rule in this file; the fold issue of
[#26](https://github.com/darthjee/ward/issues/26) applies it to `product.md`.

## Open questions

- [ ] Role permission matrix: what `owner`, `admin` and `user` can each do.
- [ ] Number of owners per organization (exactly one, or one or more).
- [ ] Leaving an organization, and deleting one.
- [ ] Invites: how a user joins an existing organization.
- [ ] Active organization: how the current organization is chosen and carried by requests.
- [ ] Backfill: creating organizations for users that already exist.
- [ ] The exact wording of the new data-ownership rule.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Owning sub-issue: https://github.com/darthjee/ward/issues/28
- Current data-ownership rule: https://github.com/darthjee/ward/blob/main/docs/agents/product.md
- Auth module (`User`, `@AdminOnly()`): https://github.com/darthjee/ward/blob/main/docs/agents/modules/auth.md

## Required tests

TBD — defined by #28
