# Issue: Implement organizations — frontend

## Description

Implement organizations in the frontend:
- creating and renaming an organization;
- an organization overview page;
- the Personal / organization context switcher;
- hash routing that is aware of the active context, so every user-or-organization-owned module
  (starting with `bank`, #49) registers its routes once and works in both contexts.

Part of Epic #26. It depends on #46 (organizations backend, merged). The specs are the source of
truth: build against them and do not re-decide anything they settle. When a spec is unclear or
wrong, raise it on the issue instead of deviating silently.

- `docs/agents/specs/auth/organizations.md`: *Active context*, *Creating an organization*,
  *Routes*, *Edge cases*, and the frontend part of *Required tests*.
- `docs/agents/specs/banking/ui/menu.md`: *Context* (the switch target for module pages, which
  #49 implements).

## Problem

- The backend serves `/orgs.json` and `/orgs/:orgId.json` (#46), but the UI has no way to create,
  see or switch to an organization.
- The hash router (`frontend/assets/js/utils/routing/`) has no notion of context:
  - `HashRouteResolver` maps a flat `ROUTES` table of `[path, pageKey]` pairs to a page key;
  - `AppHelper` maps the key to a page;
  - pages read their params with `Router.extractParams(pattern, hash)`;
  - unknown paths fall back to `home`.

  Without a shared mechanism, every bank page would have to duplicate its route under
  `orgs/:orgId` and build its own API prefix.
- The API clients (`frontend/assets/js/client/`) use hard-coded paths and have no base-path
  helper.
- On page load the frontend does not know the current user's id: `POST /auth/status.json`
  answers only `{ loggedIn, isAdmin }`. A per-user remembered context needs that id.

## Expected Behavior

- **UI paths are hash paths**:
  - Personal: `#/<module>/...`;
  - organization: `#/orgs/:orgId/<module>/...`.

  Existing routes (`/account/...`, `/admin/...`, `/recover-password`, `/`) stay Personal-only.
  Unknown paths still fall back to `home`.
- **Context switcher** in the header, on the left right after the Ward brand:

  ```text
  [Ward] [Personal ▾]            Admin Users  My account ▾  Logout
  ```

  - Its title is the active context: "Personal", or the organization name (truncated).
  - Items:
    - **Personal**;
    - a divider, then each organization by name, with the active one checked;
    - a divider, then **+ Create organization** (`#/orgs/new`).
  - With zero organizations it shows only Personal and Create organization.
  - It is hidden while logged out or pending approval.
  - The role is not shown in the switcher; the overview page shows it.
- **Switch target** — on a page with no organization variant (Home, My account, Admin, the org
  pages), switching lands on the context's landing: Personal → `#/`, organization →
  `#/orgs/:orgId`. Module pages (#49 onwards) follow `banking/ui/menu.md` instead: the same
  section's list in the new context.
- **Pages**:
  - `#/orgs/new` — create an organization (`POST /orgs.json`), then go to its overview. The
    submit button is disabled while the request is pending.
  - `#/orgs/:orgId` — **organization overview**: the name, the user's role and a Rename link. #49
    later adds the bank links here.
  - `#/orgs/:orgId/edit` — rename (`PATCH /orgs/:orgId.json`). It is reached only from the
    overview, never from the switcher.
  - Name validation in the UI: trimmed, non-empty, at most 255 code points. A backend 400 message
    is shown.
  - After a create or rename, the switcher list and the overview refresh. Other open tabs stay
    stale until reload.
- **Last used context**:
  - **When it applies** — only at the entry point (an empty hash or `#/`, e.g. right after
    login). The UI waits for `GET /orgs.json` and redirects to `#/orgs/:orgId` only if the
    remembered id is in that list. Otherwise the id is forgotten and the UI stays in Personal, so
    no request is ever sent about an organization the user is not a member of. Every other path
    is explicit: no `orgs/:orgId` prefix means Personal.
  - **What updates it** — any visit to a context-aware page (an org page, or a module page in
    either context, from #49) and any switcher pick. Context-neutral pages (Home, My account,
    Admin, recover password) leave it unchanged. Picking **Personal** stores Personal *before*
    navigating to `#/`, so the entry redirect does not bounce back.
  - **Storage** — a per-user key (`ward.context.<userId>`) that holds only the org id, never
    names. Logout does not clear it. Every access is wrapped in try/catch: when storage is
    unavailable, the UI uses Personal.
- **Not found** — one generic view with a "Go to Personal" link, identical for:
  - a malformed `:orgId` (outside `^[1-9][0-9]*$` or above 2147483647, the backend's rule): no
    request is sent;
  - a backend 404 (unknown org, or the user is not a member).

  If that id was the remembered context, it is forgotten. The view never reveals whether an
  organization exists.
- **`GET /orgs.json` fails** — the switcher still shows Personal and Create organization, with an
  inline error. Nothing crashes.
- **Names** — always rendered escaped, as React text only (never `dangerouslySetInnerHTML`).
  Long names are truncated with an ellipsis in the switcher, with the full name in `title`.
- **`POST /auth/status.json`** — the logged-in answer also returns `userId`. Every other answer
  (logged out, denied, pending) stays byte-for-byte unchanged, and the route stays `never`.

## Solution

### Router (`frontend/assets/js/utils/routing/`)

The resolver **strips the context prefix** before matching:

```text
ROUTES_PERSONAL = [['/orgs/new', 'org-new'], ...today's routes]   // Personal-only
ROUTES_ORG_ONLY = [['/', 'org-overview'], ['/edit', 'org-edit']]  // organization-only
ROUTES_CONTEXT  = []  // #49 adds e.g. ['/bank/accounts', 'bank-accounts']
```

1. Match the **Personal-only** routes. `/orgs/new` is listed here, so it is never read as an id.
2. If the path starts with `/orgs/<seg>`, validate `<seg>` with the strict rule (malformed →
   `not-found`). Then match the **rest** of the path against the organization-only and the
   **context-aware** routes.
3. Otherwise, match the **context-aware** routes as Personal.
4. Unknown paths fall back to `home`, as today.

- The resolver returns `{ page, context }`, where `context` is `{ kind: 'personal' }` or
  `{ kind: 'organization', orgId }`.
- Modules register only their own paths (e.g. `/bank/accounts/:id`) and never mention `orgs`.
- Pages extract params against the **stripped** path, so their patterns are identical in both
  contexts.

### Context flow

- `App` wraps the pages in an `OwnerContextProvider`. Pages and the switcher read it with
  `useOwnerContext()`.
- API clients take the context **as an argument**, never from global state, so the org id only
  ever comes from the active context:
  - `contextPath(context, '/bank/accounts.json')` → `/bank/accounts.json` or
    `/orgs/5/bank/accounts.json`;
  - a UI equivalent builds hash links (`#/...` vs `#/orgs/:orgId/...`);
  - `landingFor(context)` gives the switch target.

  #49 onwards reuses these helpers.
- An organizations client covers `GET` / `POST /orgs.json` and `GET` / `PATCH /orgs/:orgId.json`.
- **Org list loading**:
  - `GET /orgs.json` is fetched once per session (after login, or on load when already logged in);
  - it is refetched after a create or rename, never on navigation;
  - logout clears the in-memory list.
- The overview and rename pages fetch `GET /orgs/:orgId.json` on each visit.

### Backend (small and additive)

- The logged-in answer of `POST /auth/status.json` (`backend/src/auth/session-status.service.ts`)
  gains `userId`.
- Update the docs that describe the status response.
- The `security` and `data-access` reviews cover it.

### Caching

- No new routes, and no Navi warm-up.
- Both org GETs are `user-scoped` with `X-Skip-Cache` and `Cache-Control: private, no-store`.
  Neither Tent nor the browser stores them, so no cache-busting is needed.
- **Relies on #61.** Once per-user caching (#60) lands, `/orgs.json` and `/orgs/:orgId.json` must
  be invalidated on create and rename. #47 adds no workaround.

### Tests

The tests are Jasmine only (the project has no browser e2e), plus Jest for the backend change.
They mirror `assets/js` under `frontend/specs/assets/js` and reuse `fakeWindow`, `fetchSequence`,
`flushMicrotasks` and `renderedOutput`. They cover the spec's frontend *Required tests*, plus:

- **Routing**:
  - a context-aware route matches under both prefixes, with the right context;
  - Personal-only routes do not match under `orgs/:orgId`;
  - the malformed ids `abc`, `007`, `-1`, `1.5`, `1e3` and `99999999999` → `not-found`;
  - specs register a **test-only context-aware route** in the spec itself, so the app's route
    table gets no fake module.
- **Helpers** — `/x/y.json` vs `/orgs/5/x/y.json`, and the matching hash links.
- **Context storage**:
  - per user, so one user never reads another user's value;
  - storage that throws or is missing → Personal;
  - forgetting a context.
- **Entry resolution**:
  - a remembered org that is in the list → redirect;
  - nothing remembered → Personal;
  - a remembered org not in the list → forgotten, stays Personal, no request about it;
  - other unprefixed paths → no redirect;
  - context visits update "last used", neutral pages do not.
- **Switcher**:
  - its items, including the zero-organizations case;
  - navigation to the right landing, with Personal stored before navigating;
  - hidden while logged out or pending;
  - an inline error on a failed load;
  - names escaped and truncated.
- **Pages**:
  - validation and the backend 400 message;
  - create → overview, and the list refreshes;
  - rename refreshes the overview and the list;
  - the Not-found view for a 404 and for a malformed id.
- **Backend** — `userId` in the logged-in status answer; the other answers are unchanged.

### Out of scope

- The Bank menu and pages: #49 onwards.
- A `#/orgs` list page, since the switcher already lists the organizations.
- Joining, inviting, leaving, closing, members and role permissions: future epics.
- Refetching the org list on window focus.

### Acceptance criteria

- The frontend specs pass with `yarn test`, and `yarn lint` passes.
- The backend Jest specs and lint pass for the `/auth/status.json` change.
- The `security` and `data-access` reviews raise no unresolved violations.

## Benefits

- Users can create organizations and move between Personal and organization contexts. The
  context lives in the URL, so several tabs can each work in a different context.
- Module issues (#49 onwards) register a route once and get both contexts, with no per-page
  duplication.
- The org id comes only from a validated URL and the active context, never from storage that
  hasn't been checked, so no request is sent about an organization the user doesn't belong to.
