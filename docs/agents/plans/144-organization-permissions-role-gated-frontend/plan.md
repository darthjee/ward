# Plan: Organization permissions: role-gated frontend

Issue: [144-organization-permissions-role-gated-frontend.md](../../issues/144-organization-permissions-role-gated-frontend.md)

## Overview

Gate the frontend by the caller's organization role, mirroring the backend enforcement from
#143. A `can(role, action)` helper encodes the matrix. `OwnerContextProvider` exposes the
caller's role, which is `owner` in personal context. Forbidden controls are not rendered,
admin-only pages reached by URL show a permission message, and a 403 is classified as
`forbidden`, which renders the same message and refreshes the role. All code changes are in
`frontend/`.

See [frontend.md](frontend.md) for the full plan.

## Review (outside the frontend plan)

- No backend, proxy or cache change: there is no new endpoint and no new request parameter.
  `role` is already in `GET /orgs.json`, `GET /orgs/:id.json` and the rename `PATCH`
  response. `security` and `cache` reviews are not required.
