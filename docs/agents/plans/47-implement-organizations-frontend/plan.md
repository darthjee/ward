# Plan: Implement organizations — frontend

Issue: [47-implement-organizations-frontend.md](../../issues/47-implement-organizations-frontend.md)

## Overview

Add the frontend side of organizations: a context-aware hash router that strips the `/orgs/:orgId`
prefix (so modules from #49 onwards register their routes once), an `OwnerContextProvider` with
`contextPath` / `contextHash` / `landingFor` helpers, an organizations API client, a per-user
"last used context" store with entry resolution, the Personal / organization switcher in the header,
and the create / overview / rename / not-found pages. The backend change is small: the logged-in
answer of `POST /auth/status.json` gains `userId`, which the frontend needs to key the remembered
context per user.

Specs are the source of truth: `docs/agents/specs/auth/organizations.md` (*Active context*,
*Creating an organization*, *Routes*, *Edge cases*, frontend *Required tests*) and
`docs/agents/specs/banking/ui/menu.md` (*Context*). Any spec gap is raised on the issue, not decided
silently.

## Agents involved

- [backend](backend.md) — `userId` in the logged-in status answer (do first; small and additive)
- [frontend](frontend.md) — router, context, client, storage, switcher, pages, specs

After both finish, the coordinator:

- dispatches `security` and `data-access` on the changed files (new response field `userId`,
  user input in org name forms, org id taken from the URL);
- dispatches `cache` to confirm that no Navi change is needed (no new routes; both org GETs are
  already `user-scoped` with `X-Skip-Cache`; `/auth/status.json` stays `never`);
- updates the docs listed under "Docs (architect)" below.

## Shared contracts

### `POST /auth/status.json` (changed by backend, consumed by frontend)

| State | Body (exact) |
|---|---|
| Logged in (approved) | `{ "loggedIn": true, "isAdmin": <boolean>, "userId": <number> }` |
| Pending | `{ "loggedIn": false, "isAdmin": false, "status": "pending" }` — unchanged |
| Denied / unknown / revoked / expired token | `{ "loggedIn": false, "isAdmin": false }` — unchanged, byte-for-byte |

- `userId` is the authenticated user's numeric id (`user.id`), present **only** in the logged-in
  answer. Cache class stays `never` (`X-Skip-Cache: true`, `Cache-Control: no-store`).
- The route answers HTTP 201 today (Nest POST default); that does not change in this issue.

### Organization endpoints (existing, from #46 — frontend consumes, backend does not change)

All paths are called unprefixed from the browser (Tent routes `*.json` to the backend).

| Method | Path | Body | Success | Response |
|---|---|---|---|---|
| GET | `/orgs.json` | — | 200 | bare array of `Organization`, ordered by id |
| POST | `/orgs.json` | `{ "name": string }` | 201 | `Organization` with `role: "owner"` |
| GET | `/orgs/:orgId.json` | — | 200 | `Organization` |
| PATCH | `/orgs/:orgId.json` | `{ "name": string }` | 200 | `Organization` |

- `Organization` = `{ id: number, name: string, role: 'owner' | 'admin' | 'user', created_at: string (ISO), updated_at: string (ISO) }`.
- Errors use the global envelope `{ error: { code, message, details? }, statusCode, timestamp }`:
  - 400: `error.code = 'VALIDATION_FAILED'`, `error.message` = details joined by `'; '`
    (the frontend's `ApiError.message` already carries it);
  - 404: `{ error: { code: 'NOT_FOUND', message: 'Not Found' } ... }` — identical for unknown,
    malformed and non-member ids.
- Name rules (backend): trimmed, string, non-empty, at most 255 code points (`[...name].length`), no
  control characters. The UI validates trimmed / non-empty / at most 255 code points, and shows the
  backend 400 message for anything else.
- Org id rule (both sides): `^[1-9][0-9]*$` and `<= 2147483647`.

### Frontend-internal contracts reused by #49 onwards

- Resolver result: `{ page: string, context: { kind: 'personal' } | { kind: 'organization', orgId: number } }`.
- `contextPath(context, '/bank/accounts.json')` → `/bank/accounts.json` or `/orgs/5/bank/accounts.json`.
- `contextHash(context, '/bank/accounts')` → `#/bank/accounts` or `#/orgs/5/bank/accounts`.
- `landingFor(context)` → `#/` or `#/orgs/5`.
- Storage key `ward.context.<userId>` holds only the org id (string of digits); absent means Personal.

## Docs (architect)

- `docs/agents/backend/routes/auth.md` — `### POST /auth/status.json`: success row and the
  "Active session, `approved`" row gain `userId`.
- `docs/agents/modules/auth.md` — routes table row and the `SessionStatusService` paragraph.
- `docs/agents/backend/routes/admin.md` — the "`status.json` exposes no user id" remark is now false.
- `docs/agents/architecture/frontend.md` — `AuthEvents` payload gains `userId`; document the
  context-aware router, `OwnerContextProvider`, the helpers and the switcher.
- `docs/agents/architecture/security.md` — optional note: `userId` is returned only to the holder of
  their own active session.

## Notes

- Relies on #61: once per-user caching (#60) lands, `/orgs.json` and `/orgs/:orgId.json` must be
  invalidated on create/rename. No workaround here.
- Out of scope: Bank menu/pages (#49+), a `#/orgs` list page, joining/inviting/members/roles,
  refetching the org list on window focus.
- Pre-existing mismatch (not fixed here): docs say `/auth/status.json` returns 200, it returns 201.
