# Auth specs — organizations

Feature specs for **organizations** in the `auth` module — part of Epic
[#26](https://github.com/darthjee/ward/issues/26) (Bank module). While this folder exists it is
the source of truth for every organization decision; the sub-issues of #26 read it instead of
deciding on their own. See [specs.md](../../specs.md) for the spec lifecycle.

## Overview

Ward's first domain module, `bank` ([specs/banking/](../banking/README.md)), lets its data belong
to **either the user or an organization** (exactly one owner per record). Organizations remain a
general concept that other modules may reuse, so they belong to the `auth` module (next to
`User`), not to banking.

## Purpose

Record the organization decisions taken in #26 and defined by
[#28](https://github.com/darthjee/ward/issues/28) — revised by
[#40](https://github.com/darthjee/ward/issues/40) (optional organizations, user-or-organization
ownership) — in a single file,
[organizations.md](organizations.md). Deferred concerns (permission system, joining, closing,
creation rate limit) are listed in the banking
[Future epics](../banking/README.md#future-epics).

## Scope

In scope:

- the `Organization` entity and the `OrganizationMembership` user ↔ organization relation;
- organization roles and what they allow;
- optional organizations (none created at registration) and the active context;
- the user-or-organization-owned data-ownership rule and the `@OwnerScoped()` owner-context
  guard.

Out of scope:

- Ward's global admin role (`User.isAdmin` / `@AdminOnly()`), which is unchanged — see
  `modules/auth.md`.
- Any bank-specific entity — see [specs/banking/](../banking/README.md).

## Decisions

- **`Organization`** is a new entity owned by the `auth` module (the same module as `User`).
- **`OrganizationMembership`** links users and organizations many-to-many, with a `role` of
  `owner`, `admin` or `user`. These are **organization roles**, distinct from Ward's global
  admin role (`User.isAdmin` / `@AdminOnly()`).
- Roles are **stored but not enforced**; every organization has **exactly one owner**.
- **Organizations are optional**: zero organizations is the normal state, and users create
  them through `POST /orgs.json`.
- The **active context lives in the URL**: Personal (`/api/<module>/...`) or an organization
  (`/api/orgs/:orgId/...`).
- **Domain data can be user-or-organization-owned** (exactly one owner per record). This changes the "every domain record belongs
  to exactly one user" rule in `product.md`. The rule is **specified** in
  [organizations.md](organizations.md#data-ownership); the fold issue of #26 applies it to
  `product.md`.
- Deferred concerns are recorded in the banking
  [Future epics](../banking/README.md#future-epics), not opened as issues yet.

## Index

| File | Concern |
|---|---|
| [organizations.md](organizations.md) | `Organization` and `OrganizationMembership` entities, roles (stored, not enforced), ownership, creating an organization (optional, none at registration), active context, data ownership (user-or-organization-owned rule), routes, edge cases, security, owning module (`@OwnerScoped()` owner-context guard) |

## Sub-issue map

| Sub-issue | Files |
|---|---|
| [#27](https://github.com/darthjee/ward/issues/27) | this `README.md`; the `organizations.md` skeleton |
| [#28](https://github.com/darthjee/ward/issues/28) | `organizations.md` |
| [#40](https://github.com/darthjee/ward/issues/40) | `organizations.md` (optional organizations, active context, user-or-organization ownership, `@OwnerScoped()`); this `README.md` |
| Implementation / fold / remove sub-issues of #26 (created later) | build against this folder; the fold folds `organizations.md` into `docs/agents/modules/auth/` and removes this folder |

This folder is consumed by [specs/banking/](../banking/README.md): organizations are implemented
before any bank entity.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- This sub-issue: https://github.com/darthjee/ward/issues/27
- Organizations sub-issue: https://github.com/darthjee/ward/issues/28
- Revising sub-issue: https://github.com/darthjee/ward/issues/40
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md
- Current data-ownership rule: https://github.com/darthjee/ward/blob/main/docs/agents/product.md
- Auth module: https://github.com/darthjee/ward/blob/main/docs/agents/modules/auth.md

## Required tests

None for this index; the tests are defined in each file listed in the [index](#index).
