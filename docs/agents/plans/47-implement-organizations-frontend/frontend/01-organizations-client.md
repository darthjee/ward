# API client GET support, organizations client and name validator

`ApiClient` has `postJson` / `patchJson` / `deleteJson` only, and its private `request` always sends
`body: JSON.stringify(body)` — fetch rejects a GET with a body. Add `getJson(path)` that sends no
body (same `credentials: 'same-origin'`, headers, 401-refresh-and-retry and error handling).

Add `client/OrganizationsClient.js`, a plain exported object like `AccountsClient`:

- `list()` → `ApiClient.getJson('/orgs.json')`;
- `create(name)` → `ApiClient.postJson('/orgs.json', { name })`;
- `show(orgId)` → `ApiClient.getJson(`/orgs/${orgId}.json`)`;
- `rename(orgId, name)` → `ApiClient.patchJson(`/orgs/${orgId}.json`, { name })`.

Callers only ever pass an `orgId` taken from the validated active context (step 02/03) — the client
does not read any global state. Each method may resolve `undefined` (session expired).

Add `validateOrganizationName(name)` to `utils/validation/fieldValidators.js`: trims, rejects empty,
rejects more than 255 code points (`[...trimmed].length > 255`), otherwise valid. Exactly 255 code
points (including astral characters such as emoji) is valid. Follow the existing validator return
convention.

Specs:

- `ApiClientSpec`: `getJson` sends a GET with no body, parses JSON, 401 refresh path, non-OK →
  `ApiError` with the backend message.
- `OrganizationsClientSpec`: each method hits the right method/path/body (use `fetchSequence`).
- `fieldValidatorsSpec`: empty, whitespace-only, 255 vs 256 code points, astral characters.

## Files to Change
- `frontend/assets/js/client/ApiClient.js` — add `getJson(path)` without a body.
- `frontend/assets/js/client/OrganizationsClient.js` — new.
- `frontend/assets/js/utils/validation/fieldValidators.js` — add `validateOrganizationName`.
- `frontend/specs/assets/js/client/ApiClientSpec.js` — `getJson` cases.
- `frontend/specs/assets/js/client/OrganizationsClientSpec.js` — new.
- `frontend/specs/assets/js/utils/validation/fieldValidatorsSpec.js` — org name cases.
