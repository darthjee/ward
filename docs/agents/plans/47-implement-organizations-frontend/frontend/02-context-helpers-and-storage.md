# Owner-context helpers and context storage

Pure helpers every module will reuse (#49 onwards), plus the per-user "last used context" store.

`utils/context/ownerContext.js` (pure, no DOM):

- `PERSONAL` = `{ kind: 'personal' }` (frozen) and `organizationContext(orgId)` →
  `{ kind: 'organization', orgId }`;
- `parseOrgId(segment)` → number or `null`; valid only if it matches `^[1-9][0-9]*$` and is
  `<= 2147483647` (the backend rule). `abc`, `007`, `-1`, `1.5`, `1e3`, `99999999999`, `0`, `''` →
  `null`;
- `contextPath(context, apiPath)` → `apiPath` for Personal, `/orgs/<id><apiPath>` for an org
  (e.g. `/x/y.json` vs `/orgs/5/x/y.json`);
- `contextHash(context, uiPath)` → `#<uiPath>` or `#/orgs/<id><uiPath>`; `uiPath` `'/'` in an org
  context yields `#/orgs/<id>` (no trailing slash);
- `landingFor(context)` → `#/` or `#/orgs/<id>`;
- `isSameContext(a, b)`.

`utils/context/ContextStorage.js` (object module, injectable storage for specs, defaulting to
`window.localStorage` resolved lazily and SSR-safe):

- key `ward.context.<userId>`; the value is the org id only, never names;
- `read(userId)` → a validated org id (re-checked with `parseOrgId`) or `null` (Personal);
- `rememberOrganization(userId, orgId)`, `rememberPersonal(userId)` (removes the key);
- `forget(userId)` / `forgetIfMatches(userId, orgId)` (used when a remembered id turns out stale);
- every storage access is wrapped in try/catch; missing or throwing storage → `null` / no-op
  (Personal). No `userId` → no-op / `null`.
- Logout does not clear it.

Specs:

- helpers: both contexts for `contextPath`, `contextHash`, `landingFor`; every malformed id listed
  in the issue plus the max boundary (`2147483647` valid, `2147483648` invalid);
- storage: per-user isolation (user 1 never reads user 2's value), garbage values read as `null`,
  storage that throws on get/set/remove, storage missing entirely, forgetting.

## Files to Change
- `frontend/assets/js/utils/context/ownerContext.js` — new.
- `frontend/assets/js/utils/context/ContextStorage.js` — new.
- `frontend/specs/assets/js/utils/context/ownerContextSpec.js` — new.
- `frontend/specs/assets/js/utils/context/ContextStorageSpec.js` — new.
