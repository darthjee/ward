# Routing: query parser, page keys and section registry

Lay the routing groundwork every later step relies on.

1. **Page keys** — fill `ROUTES_CONTEXT` in `frontend/assets/js/utils/routing/routes.js`, in this
   order (`Route` matches by equal segment count and `Router.match` is first-match-wins, so `new`
   must precede `:accountId`):
   - `['/bank/accounts', 'bank-accounts']`
   - `['/bank/accounts/new', 'bank-account-new']`
   - `['/bank/accounts/:accountId/edit', 'bank-account-edit']`
   - `['/bank/accounts/:accountId', 'bank-account']`

   Registering them in `ROUTES_CONTEXT` makes them work under both `#/...` and
   `#/orgs/:orgId/...` and makes `entryResolution.trackVisit` remember the context. The pages are
   wired into `AppHelper`'s `PAGES` map in steps 07–09 (until then the keys fall back to `home`;
   alternatively register placeholders — keep the build green either way).

2. **Section registry** — next to `ROUTES_CONTEXT`, export an ordered list (e.g.
   `SECTIONS_CONTEXT = [['/bank/accounts', '/bank/accounts']]`) mapping a context-relative path
   prefix to its section's list path, with a JSDoc noting that #51/#53/#55/#57 add their own rows.
   Add a pure helper (e.g. `utils/routing/sectionTarget.js`) exporting
   `sectionListPathFor(hash, sections = SECTIONS_CONTEXT)`:
   - strip `#` and the query (`hashPath`), then any valid `/orgs/:orgId` prefix
     (`splitOrgPrefix` / `stripContextPrefix`);
   - match by prefix **on a segment boundary** (`/bank/accounts` matches `/bank/accounts` and
     `/bank/accounts/12/edit`, not `/bank/accountsx`);
   - return the list path or `null`.

   And a `switchTargetFor(hash)` factory returning `(context) => sectionListPath ?
   contextHash(context, sectionListPath) : landingFor(context)` — the function passed to
   `ContextSwitcherController.pick` and used for item hrefs in step 05.

3. **Hash query parser** — add a shared `utils/routing/hashQuery.js` with
   `hashQuery(hash)` → `URLSearchParams` of the part after `?` (empty when absent), plus a
   `withHashQuery(path, params)` builder that omits empty values. Do not refactor
   `ResetPasswordLanding` (out of scope).

Specs: segment-boundary matching, org prefix stripped, query dropped, no match → `null` /
landing page, the three example rows of the issue's table; the query parser for missing,
empty and multiple params.

## Files to Change
- `frontend/assets/js/utils/routing/routes.js` — bank page keys in `ROUTES_CONTEXT`; `SECTIONS_CONTEXT` registry
- `frontend/assets/js/utils/routing/sectionTarget.js` — new: `sectionListPathFor`, `switchTargetFor`
- `frontend/assets/js/utils/routing/hashQuery.js` — new: hash query parse / build helpers
- `frontend/specs/assets/js/utils/routing/sectionTargetSpec.js` — new
- `frontend/specs/assets/js/utils/routing/hashQuerySpec.js` — new
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js` (or the existing routes spec) — bank keys resolve in Personal and under `/orgs/:orgId`, `new` before `:accountId`
