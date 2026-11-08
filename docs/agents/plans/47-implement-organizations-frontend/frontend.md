# Frontend Plan: Implement organizations — frontend

Main plan: [plan.md](plan.md)

## Shared contracts

What the backend produces (`POST /auth/status.json`):

- logged in: `{ loggedIn: true, isAdmin: boolean, userId: number }`;
- pending: `{ loggedIn: false, isAdmin: false, status: 'pending' }`;
- otherwise: `{ loggedIn: false, isAdmin: false }`.

Organization endpoints (existing from #46, unprefixed paths):

- `GET /orgs.json` → 200, bare array of `Organization`;
- `POST /orgs.json` `{ name }` → 201, `Organization` (`role: 'owner'`);
- `GET /orgs/:orgId.json` → 200, `Organization`;
- `PATCH /orgs/:orgId.json` `{ name }` → 200, `Organization`.
- `Organization` = `{ id: number, name: string, role: 'owner'|'admin'|'user', created_at: string, updated_at: string }`.
- 400 → `ApiError` with `status 400` and the backend message in `message`; 404 → `ApiError.status === 404`
  (identical for unknown, malformed and non-member ids).
- Org id rule: `^[1-9][0-9]*$` and `<= 2147483647`.

What this agent produces for #49 onwards:

- resolver result `{ page, context }`, `context` = `{ kind: 'personal' }` or `{ kind: 'organization', orgId }`;
- `contextPath(context, apiPath)`, `contextHash(context, uiPath)`, `landingFor(context)`;
- `ROUTES_CONTEXT` (empty here) where modules register their own context-aware paths;
- `useOwnerContext()`; pages extract params against the **stripped** path;
- storage key `ward.context.<userId>` holding only the org id.

## Steps

- [01 — API client GET support, organizations client and name validator](frontend/01-organizations-client.md)
- [02 — Owner-context helpers and context storage](frontend/02-context-helpers-and-storage.md)
- [03 — Context-aware hash router](frontend/03-context-aware-router.md)
- [04 — Carry `userId` through the auth status flow](frontend/04-auth-user-id.md)
- [05 — Owner-context provider, org list loading and entry resolution](frontend/05-owner-context-provider.md)
- [06 — Context switcher in the header](frontend/06-context-switcher.md)
- [07 — Organization pages and the Not-found view](frontend/07-organization-pages.md)

## CI Checks

- `frontend`: `docker-compose run --rm ward_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- Specs only use `renderToStaticMarkup` (no React test renderer), so effects never run in specs.
  Follow the existing pattern: put effect bodies in exported `buildXEffect` functions and logic in
  controllers taking injectable clients/storage, and test those directly.
- Reuse `specs/support/fakeWindow.js`, `fetchSequence.js`, `flushMicrotasks.js`,
  `renderedOutput.js`, `renderCapturingHandlers.js`. Specs mirror `assets/js` under
  `specs/assets/js`.
- Do **not** grow `LoginModalController.js` (294/300 lines). Hook org-list loading on `AuthEvents`.
- After login, `redirectHome()` sets the hash to `/`; if it was already `#/`, no `hashchange` fires.
  Entry resolution must therefore run off the auth event + org-list load, not `hashchange`.
- `ApiClient.sessionExpired()` emits no `AuthEvent`; the in-memory org list is cleared on explicit
  logout (issue requirement). Do not widen scope beyond that unless trivial.
- `ApiClient` resolves to `undefined` after a failed refresh (session expired): every new caller must
  tolerate an `undefined` result.
- Names are always React text (never `dangerouslySetInnerHTML`). Long names in the switcher use
  Bootstrap `text-truncate` with a max width and the full name in `title`.
- Complexity (<=10) and max-lines (300) are lint warnings; keep files small and split helpers.
- If a spec turns out unclear or wrong, stop and report it to the coordinator instead of deviating.
