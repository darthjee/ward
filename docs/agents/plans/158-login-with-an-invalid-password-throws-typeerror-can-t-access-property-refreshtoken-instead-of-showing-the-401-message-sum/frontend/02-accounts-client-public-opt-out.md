# AccountsClient: public routes opt out

In `frontend/assets/js/client/AccountsClient.js`, pass `{ skipAuthRecovery: true }` as the
options argument on every `@Public()` route:

- `register` (`/auth/register.json`)
- `login` (`/auth/login.json`)
- `refresh` (`/auth/refresh.json`)
- `status` (`/auth/status.json`)
- `recover` (`/auth/recover.json`)
- `resetPassword` (`/auth/reset-password.json`)
- `createAuthorizationRequest` (`/auth/authorization-requests.json`)
- `pollAuthorizationRequest` (`/auth/authorization-requests/:uuid/poll.json`)

Use one shared module constant (e.g. `const PUBLIC = { skipAuthRecovery: true }`). The
authenticated methods (`logout`, `listAuthorizationRequests`, `authorizeAuthorizationRequest`,
`denyAuthorizationRequest`, `getAccount`, `updateAccount`) keep the default. Update their JSDoc
so no method claims a possible `undefined` resolve.

`utils/polling/AuthorizationRequestPoller.js`: drop the "falsy/`undefined` resolve" wording from
the JSDoc (L8–12). A 401 from poll now rejects and goes through `handlePollError`, which
reschedules. Keep the falsy-result guard only if it is still needed for other reasons.

Specs:
- `AccountsClientSpec.js`: update the `toHaveBeenCalledWith` expectations so each public method
  passes `{ skipAuthRecovery: true }` and each authenticated one passes none. For
  `login`/`register`/`refresh`, add cases where `postJson` rejects with
  `ApiError(401, 'Invalid username or password', 'UNAUTHORIZED')`: the promise rejects with
  that same error and `AuthSession.set`/`clear` are never called.
- `AccountsClientAuthorizationRequestsSpec.js`: `create`/`poll` pass the opt-out, the others don't.
- `AuthorizationRequestPollerSpec.js`: replace the "`undefined` resolve" case with a rejected 401
  that reschedules.

## Files to Change
- `frontend/assets/js/client/AccountsClient.js` — opt-out on public methods, JSDoc
- `frontend/assets/js/utils/polling/AuthorizationRequestPoller.js` — JSDoc and the undefined guard
- `frontend/specs/assets/js/client/AccountsClientSpec.js`
- `frontend/specs/assets/js/client/AccountsClientAuthorizationRequestsSpec.js`
- `frontend/specs/assets/js/utils/polling/AuthorizationRequestPollerSpec.js` (path as found)
