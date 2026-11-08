# Owner-context provider, org list loading and entry resolution

`App` wraps the pages in an `OwnerContextProvider`; pages and the switcher read it with
`useOwnerContext()`.

Provider value: `{ context, page, userId, orgs, orgsLoaded, orgsError, refreshOrgs }`.

- `context` / `page` come from the resolver route object (step 03) — the URL is the only source of
  the active context.
- `userId` comes from the `AuthEvents` detail (step 04).

**Org list loading** (`OrgListController`, injectable `OrganizationsClient` and event bus;
`buildOrgListEffect` exported for specs):

- fetch `GET /orgs.json` once per session: on a logged-in `AuthEvents` event (after login, or on page
  load when already logged in) — not on navigation;
- `refreshOrgs()` refetches; called after create and rename;
- a logged-out event clears the in-memory list, `userId` and the error;
- a failed load sets `orgsError` (list stays empty), never throws; an `undefined` result (session
  expired) is tolerated.

**Entry resolution** (`utils/context/entryResolution.js`, pure apart from injected storage and a
navigate function):

- `resolveEntry({ hash, userId, orgs, storage })` runs only when the hash is empty or `#/`, and only
  after the org list has loaded. If the remembered id (`ContextStorage.read(userId)`) is in `orgs`
  → return `#/orgs/<id>`; otherwise forget it and return `null` (stay Personal). No request is ever
  sent about the remembered id itself. On a failed list load: stay Personal (do not forget).
- Other unprefixed paths → `null` (explicit Personal, no redirect).
- `trackVisit(route, userId, storage)`: context-aware pages (`org-overview`, `org-edit`, and any page
  from `ROUTES_CONTEXT`) remember their context (organization → `rememberOrganization`, Personal
  context-aware page → `rememberPersonal`). Context-neutral pages (home, my account, admin, recover
  password, `org-new`, `not-found`) leave it unchanged.
- Run entry resolution from the org-list-loaded transition (not from `hashchange`: after login the
  hash may already be `#/`). Run `trackVisit` on each route change.

Wire the provider in `AppHelper.render(route)`, wrapping the `Header` + page tree, and adjust
`AppHelperSpec.partsOf` for the new tree shape.

Specs:

- entry: remembered org in list → redirect; nothing remembered → Personal; remembered org not in list
  → forgotten, stays Personal, `fetch` called only for `/orgs.json`; non-entry unprefixed paths → no
  redirect; failed list → Personal;
- `trackVisit`: context pages update "last used", neutral pages do not;
- org list: fetched once on login, not refetched on navigation, refetched by `refreshOrgs`, cleared
  on logout, error state on failure.

## Files to Change
- `frontend/assets/js/components/common/ownerContext/OwnerContextProvider.jsx` — new.
- `frontend/assets/js/components/common/ownerContext/hooks/useOwnerContext.js` — new.
- `frontend/assets/js/components/common/ownerContext/controllers/OrgListController.js` — new.
- `frontend/assets/js/utils/context/entryResolution.js` — new.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — wrap in the provider.
- `frontend/assets/js/App.jsx` — feed the route into the provider if needed.
- Matching specs under `frontend/specs/assets/js/...`, plus `AppHelperSpec.js` update.
