# Plan: Implement organizations — backend

Issue: [46-implement-organizations-backend.md](../../issues/46-implement-organizations-backend.md)

## Overview
Add the `Organization` / `OrganizationMembership` entities and the `/orgs.json` routes to the
always-on `auth` module. Add the owner-context machinery to `core`: `OwnerContext`,
`ownerWhere()`, `parseOrgId()`, the uniform 404, strict body validation,
`@OwnerScopedController` / `@OwnerScoped()`, `@CurrentOwner()`, the
`ORGANIZATION_MEMBERSHIP_LOOKUP` port and the fourth global `OwnerContextGuard`. Every
user-or-organization-owned module (starting with `bank`, #48) builds on this. Almost all of the
work is in `backend/`. The only other change is the `data-access` reviewer update, which the
architect owns.

See [backend.md](backend.md) for the full plan.

## Architect-owned step — update the `data-access` reviewer
`.claude/agents/data-access.md` is outside every specialist's scope, so the architect edits it
as the fallback owner, before the reviews of this issue run. Add a "User-or-organization-owned
modules" section that links `docs/agents/specs/auth/organizations.md` (§ *`data-access` checks
for user-or-organization-owned modules*) and checks that:

- every query is filtered through `OwnerContext` / `ownerWhere()`;
- personal routes use only the JWT user;
- every `orgs/:orgId/...` route verifies membership (via `@OwnerScopedController`, or
  `OrganizationService` for the org routes themselves);
- no owner fields are read from input or written to output;
- unknown id, malformed id, wrong context and non-member all return identical 404s.

Replace the "every domain record belongs to one user" baseline with: user-owned modules keep
the current checks; `bank` is user-or-organization-owned. Note that #58 repoints the file at the
permanent docs.

## Reviews after implementation
- `security`: new endpoints, authorization logic and user input.
- `data-access`: new entities, endpoints and response fields.
- `cache`: the new routes are user-scoped or never, so none of them belongs in Navi's warm-up.
  Confirm `X-Skip-Cache` on the GETs.
