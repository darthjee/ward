# Context-aware hash router

Today `HashRouteResolver.getPage()` returns a page key from a private flat `ROUTES` table, and
`Router.resolve()` falls back to `'home'` internally (so "no match" cannot be told apart).

Route tables, in a new `utils/routing/routes.js`:

```text
ROUTES_PERSONAL = [['/orgs/new', 'org-new'], ...today's routes]   // Personal-only, '/' → 'home' last
ROUTES_ORG_ONLY = [['/', 'org-overview'], ['/edit', 'org-edit']]  // organization-only
ROUTES_CONTEXT  = []                                              // #49 adds e.g. ['/bank/accounts', 'bank-accounts']
```

`Router.js`: add `match(path)` → page or `null`; keep `resolve(path)` (string, `'home'` fallback) so
`RouterSpec` stays valid.

`HashRouteResolver.js`: add `resolve()` returning `{ page, context }` with the lookup:

1. match Personal-only routes (so `/orgs/new` is never read as an id) → Personal context;
2. if the path starts with `/orgs/<seg>`: `parseOrgId(seg)`; malformed → `{ page: 'not-found',
   context: PERSONAL }` (no request will be sent). Otherwise match the **rest** (empty → `'/'`)
   against `ROUTES_ORG_ONLY`, then the context routes, with `organizationContext(orgId)`. A valid id
   with an unknown rest falls through to step 4 (`home`), as the issue keeps "unknown paths fall back
   to `home`";
3. otherwise match the context routes as Personal;
4. otherwise `{ page: 'home', context: PERSONAL }`.

The constructor takes `(hashProvider, { contextRoutes = ROUTES_CONTEXT } = {})` so specs register a
**test-only** context-aware route without touching the app's table. Keep `getPage()` as a thin
`resolve().page` wrapper only if it eases migration; otherwise update callers.

Add a stripped-path helper so pages extract params identically in both contexts: e.g.
`stripContextPrefix(hash)` in `ownerContext.js` / routing, used by `Router.extractParams` (or a new
`Router.extractContextParams(pattern, hash)`). Existing `extractParams` callers (e.g.
`AdminUserEdit`) must keep working.

Callers to migrate to the `{ page, context }` route object: `AppController.getPage` and its
`hashchange` handler, `App.jsx` (state holds the route object; initial value
`{ page: 'home', context: PERSONAL }`), `AppHelper.render(route)` (page lookup by `route.page`;
context is consumed in step 05).

Specs:

- `HashRouteResolverSpec`: migrate existing assertions; a test-only context route matches under `/x`
  (Personal) and `/orgs/5/x` (org 5); Personal-only routes do not match under `/orgs/5/...`;
  `/orgs/new` → `org-new`; `/orgs/5` → `org-overview`, `/orgs/5/edit` → `org-edit`; malformed ids
  `abc`, `007`, `-1`, `1.5`, `1e3`, `99999999999` → `not-found`; unknown paths → `home`; query
  strings stripped.
- `RouterSpec`: `match` returns `null` on no match; stripped-path param extraction.
- `AppControllerSpec`: route objects passed to `setPage`.

## Files to Change
- `frontend/assets/js/utils/routing/routes.js` — new route tables.
- `frontend/assets/js/utils/routing/Router.js` — `match(path)`, stripped-path param extraction.
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — `resolve()` → `{ page, context }`, injectable context routes.
- `frontend/assets/js/components/AppController.js` — route objects.
- `frontend/assets/js/App.jsx` — route state.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — accept a route object.
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js`, `RouterSpec.js` — cases above.
- `frontend/specs/assets/js/components/AppControllerSpec.js`, `components/helpers/AppHelperSpec.js` — migrate.
