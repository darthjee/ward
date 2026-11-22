# Frontend Plan: Login with an invalid password throws `TypeError` instead of showing the 401 message

Main plan: [plan.md](plan.md)

## Overview
All code changes live in `frontend/`. `ApiClient` gains a per-call `{ skipAuthRecovery: true }`
option and a reject-on-expiry contract. `AccountsClient` opts out on every `@Public()` route.
Every consumer that relied on the `undefined` resolve is migrated to a single
`isSessionExpired(error)` check. The final step (docs) is owned by the architect.

## Context
`POST /auth/login.json` answers `401 { error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' } }`,
but `ApiClient.sendJson` routes every `401` into `handleUnauthorized`/`sessionExpired()`, which
clears `AuthSession`, re-opens the modal and resolves `undefined`. `AccountsClient.login` then
reads `result.refreshToken` and throws a `TypeError`. With a stored refresh token, a wrong
password also rotates and then clears the token, logging the user out.

`LoginModalController#submitPassword` and `LoginErrorMessages.forLogin` already map an
`ApiError` correctly (unmapped `UNAUTHORIZED` falls back to `error.message`, `USER_DENIED` maps
to "This account has been denied access."). They need no change once `login` rejects properly.

## Contract decided for this plan

- `ApiClient.getJson(path, options)`, `postJson(path, body, options)`,
  `deleteJson(path, body, options)`, `patchJson(path, body, options)`. `options` is optional,
  `{ skipAuthRecovery?: boolean }`, default `false`.
- `skipAuthRecovery: true`: a `401` goes straight to `throw buildApiError(response, data)`. No
  refresh request, no retry, no `AuthSession` change, no `LoginModalEvents.open`.
- Default routes, failed recovery (no stored refresh token / refresh fails / retried request
  answers `401` again): run `AuthSession.clear()` + `LoginModalEvents.open('password')`, then
  **throw** the `ApiError` built from the **original (first)** `401` response, with
  `error.sessionExpired === true`.
- `ApiError` gets a `sessionExpired` boolean field, default `false`.
- New helper `isSessionExpired(error)` in `frontend/assets/js/client/` (e.g.
  `client/isSessionExpired.js`), returning `true` only for an `ApiError` whose `sessionExpired`
  is `true`. Consumers use this, **not** `status === 401`, because opted-out public-route 401s
  are real credential errors that must still be shown.
- Rule: a session-expired rejection is never shown as an error by a consumer. The consumer
  resets its pending/loading/confirm state and returns.

## Steps

- [01 — ApiClient: opt-out and reject-on-expiry](frontend/01-api-client-opt-out-and-reject.md)
- [02 — AccountsClient: public routes opt out](frontend/02-accounts-client-public-opt-out.md)
- [03 — Bank consumers: handle session-expired rejection](frontend/03-bank-consumers.md)
- [04 — Non-bank consumers: handle session-expired rejection](frontend/04-non-bank-consumers.md)
- [05 — Login modal end-to-end specs](frontend/05-login-modal-specs.md)
- [06 — Docs (architect)](frontend/06-docs.md)

## CI Checks
- `frontend`: `docker-compose run --rm ward_fe yarn test` / `yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes
- Several spec files are close to the 300-line limit (`ApiClientSpec.js` 295 lines,
  `LoginModalControllerSpec.js` 300 lines). Put new cases in sibling spec files instead of
  growing them.
- `sendJson` complexity must stay under the ESLint limit. Replace its positional `isRetry`
  boolean with an options object (`{ skipAuthRecovery, isRetry, originalError }`) rather than
  adding more positional args.
- About 20 existing specs encode the old `undefined` contract (listed in steps 03–04). They must
  be migrated to "rejects with a session-expired `ApiError` and the consumer shows nothing", not
  deleted.
- `logout` (`/auth/logoff.json`) is not `@Public()`. It keeps default recovery, and its
  `finally AuthSession.clear()` is unchanged.
- Run all commands through `docker-compose run --rm ward_fe ...`, never on the host.
