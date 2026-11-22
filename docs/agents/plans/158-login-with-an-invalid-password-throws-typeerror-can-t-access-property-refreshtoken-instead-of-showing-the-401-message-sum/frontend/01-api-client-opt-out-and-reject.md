# ApiClient: opt-out and reject-on-expiry

Make the core change in `frontend/assets/js/client/ApiClient.js`:

- Add a trailing optional `options` argument (`{ skipAuthRecovery = false }`) to `getJson`,
  `postJson`, `deleteJson` and `patchJson`, and forward it to `sendJson`.
- Change `sendJson(method, path, body, isRetry = false)` to
  `sendJson(method, path, body, { skipAuthRecovery = false, isRetry = false, originalError } = {})`.
  On `401` with `skipAuthRecovery`, fall through to `throw buildApiError(response, data)`. On
  `401` without it, build `const error = originalError ?? buildApiError(response, data)`; if
  `isRetry`, call `sessionExpired(error)`, otherwise `handleUnauthorized(method, path, body, error)`.
- `handleUnauthorized(method, path, body, originalError)`: no token or failed refresh →
  `sessionExpired(originalError)`. Successful refresh → `AuthSession.set(...)`, then
  `sendJson(method, path, body, { isRetry: true, originalError })`.
- `sessionExpired(error)`: run `AuthSession.clear()` and `LoginModalEvents.open('password')`
  (when `window` exists), set `error.sessionExpired = true`, then `throw error`. It never returns.
- `ApiError` (`client/ApiError.js`): add a `sessionExpired` field initialised to `false`.
- Add `client/isSessionExpired.js` exporting `isSessionExpired(error)`
  (`error instanceof ApiError && error.sessionExpired === true`).
- Remove every "`undefined` when the session turned out to be expired" phrase from the JSDoc
  (`sessionExpired`, `sendJson`, `handleUnauthorized`, the `ApiClient` object doc, and all four
  public methods). Document `options.skipAuthRecovery` and the rejection.

Specs:
- `ApiClientSpec.js`'s existing "401 handling" cases (failed refresh, missing token, retry 401
  again) now assert that the call **rejects** with an `ApiError` that has the first 401's status,
  code and message and `sessionExpired === true`, in addition to `expectSessionExpired()`.
  Refresh-and-retry success is unchanged.
- New sibling spec (e.g. `ApiClientSkipAuthRecoverySpec.js`): with `skipAuthRecovery: true` a
  `401` rejects with an `ApiError` carrying the body's code/message, `sessionExpired === false`,
  only one fetch was made (no refresh), and `AuthSession.get/set/clear` and
  `LoginModalEvents.open` were not called. Cover each HTTP verb's option forwarding.
- `ApiErrorSpec.js`: default `sessionExpired` is `false`.
- New `isSessionExpiredSpec.js`: `true` for a marked `ApiError`, `false` for an unmarked
  `ApiError`, a plain `Error`, `undefined`.

## Files to Change
- `frontend/assets/js/client/ApiClient.js` — options argument, opt-out branch, reject-on-expiry, JSDoc
- `frontend/assets/js/client/ApiError.js` — `sessionExpired` field
- `frontend/assets/js/client/isSessionExpired.js` — new helper
- `frontend/specs/assets/js/client/ApiClientSpec.js` — failed-recovery cases now reject
- `frontend/specs/assets/js/client/ApiClientSkipAuthRecoverySpec.js` — new
- `frontend/specs/assets/js/client/ApiErrorSpec.js` — new field default
- `frontend/specs/assets/js/client/isSessionExpiredSpec.js` — new
- `frontend/specs/support/fetchSequence.js` — only if a helper for "rejects with session-expired ApiError" is useful
