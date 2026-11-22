# Issue: Login with an invalid password throws `TypeError: can't access property "refreshToken"` instead of showing the 401 message

## Description

`POST /auth/login.json` answers correctly with `401` and the standard error body (`{ error: { code: "UNAUTHORIZED", message: "Invalid username or password" } }`), but the login modal never renders that message. Instead the console shows `TypeError: can't access property "refreshToken", result is undefined` and the modal displays that raw JavaScript message.

The backend matches its documented contract (`docs/agents/backend/routes/auth.md`; `@CachePolicy(CacheClass.Never)`, so the Tent cache is not involved). The defect is entirely in the frontend HTTP layer (`frontend/assets/js/client/ApiClient.js`).

Reproduction (deterministic, with or without a stored refresh token): open the login modal in password mode, enter a valid username with a wrong password, submit.

## Problem

`ApiClient` treats **every** `401` as an expired access token, including `401`s from `@Public()` routes, where a 401 means *invalid credentials/token*:

1. `sendJson` sends every `401` to `handleUnauthorized` (or straight to `sessionExpired()` on a retry) before `buildApiError` runs, so the `ApiError` carrying `UNAUTHORIZED` / `Invalid username or password` is never built.
2. `handleUnauthorized` ends in `sessionExpired()` on both failure paths:
   - no stored refresh token → `sessionExpired()` immediately;
   - stored refresh token → the refresh succeeds and rotates the token, the login is retried, fails with `401` again, and the retry branch calls `sessionExpired()`.
3. `sessionExpired()` clears `AuthSession`, re-opens the login modal (`LoginModalEvents.open('password')`), and **resolves `undefined`**.
4. `AccountsClient.login` then dereferences `result.refreshToken` → `TypeError`.
5. `LoginModalController#submitPassword` catches it, but `LoginErrorMessages.forLogin` has no `code` to map, so it falls back to the engine's `error.message`.

Side effects beyond the crash:

- **A mistyped password logs the user out.** With a valid stored refresh token, the token is rotated and then `AuthSession.clear()` wipes it.
- **The same crash affects sibling methods:** `register`, `refresh` (`AuthSession.set(result.refreshToken)`) and `pollAuthorizationRequest` (`result.status`).
- **Every other `ApiClient` consumer** resolves `undefined` after a failed session recovery. Any consumer that reads the resolved value can crash the same way.

The docs describe the current behavior (`docs/agents/architecture/frontend.md`: "`client/ApiClient.js` reacts to a `401` transparently rather than surfacing it to callers"). That is right for authenticated routes and wrong for the public auth routes, whose purpose is to establish a session. A carve-out already exists for `403 USER_DENIED` on login, but there is none for `401`.

## Expected Behavior

- A wrong password keeps the modal open and shows the backend's message: `Invalid username or password`.
- No JavaScript exception is thrown.
- No session state changes: the stored refresh token is not rotated or cleared, and `LoginModalEvents.open` is not fired.
- `403 USER_DENIED` on login still shows `This account has been denied access.`
- On authenticated routes, a `401` still triggers one refresh-and-retry. When recovery fails, the session still ends (`AuthSession.clear()` + login modal opened), but the awaiting caller now gets a **rejected promise with an `ApiError`** instead of a resolved `undefined`.

## Solution

Two complementary changes in `frontend/assets/js/client/`:

### 1. Public auth routes opt out of 401 recovery

Add an opt-out to `ApiClient` (for example an options argument such as `{ skipAuthRecovery: true }`, or an equivalent mechanism) so a `401` goes straight to `buildApiError` and is thrown as a normal `ApiError`: no refresh, no retry, no `sessionExpired()`.

Every `AccountsClient` method that calls an `@Public()` backend route uses it:

- `register` (`/auth/register.json`)
- `login` (`/auth/login.json`)
- `refresh` (`/auth/refresh.json`)
- `status` (`/auth/status.json`)
- `recover` (`/auth/recover.json`)
- `resetPassword` (`/auth/reset-password.json`)
- `createAuthorizationRequest` (`/auth/authorization-requests.json`)
- `pollAuthorizationRequest` (`/auth/authorization-requests/:uuid/poll.json`)

Rule: a public route never attempts session recovery. Authenticated `AccountsClient` methods (`listAuthorizationRequests`, `authorize…`, `deny…`, `getAccount`, `updateAccount`, `logout`) keep the default behavior.

### 2. Failed session recovery rejects instead of resolving `undefined`

When recovery fails (no stored refresh token, the refresh itself fails, or the retried request answers `401` again), `ApiClient` still runs the session-expired side effects (`AuthSession.clear()` + `LoginModalEvents.open('password')`). It then **throws an `ApiError`** built from the original `401` response (status, code, message), instead of returning `undefined`.

- Remove the "`undefined` when the session turned out to be expired" return contract from the JSDoc of `sendJson`, `handleUnauthorized`, `sessionExpired` and every public `ApiClient` method.
- Audit existing callers that relied on the silent `undefined`. A caller's catch block must not show a confusing error next to the re-opened login modal. If needed, let callers recognize a session-expired rejection (for example by `status === 401`) and skip their own error message.

### Specs (Jasmine)

- `ApiClient`: an opted-out `401` throws an `ApiError` with the body's code and message, makes no refresh request, and leaves `AuthSession` untouched. On a default route, failed recovery (each of the three paths) clears the session, opens the modal, **and rejects** with an `ApiError`.
- `AccountsClient`: each public method passes the opt-out. `login`/`register`/`refresh` reject with the `ApiError` and never touch `AuthSession` on a `401`.
- Login modal:
  - wrong password with no stored refresh token shows `Invalid username or password`;
  - wrong password with a valid stored refresh token shows the same message, and the stored token is neither rotated nor cleared;
  - `403 USER_DENIED` still shows `This account has been denied access.`

### Docs

Update `docs/agents/architecture/frontend.md` ("Auth flow", "Login modal", "API errors"), `docs/agents/flow.md` ("Session renewal") and `docs/agents/backend/routes/auth.md` (next to the existing `403` carve-out). They should describe the public-route opt-out and the new reject-on-expiry contract.

## Benefits

- Users see the real credential error instead of a JavaScript exception.
- A mistyped password no longer silently logs out an existing session.
- `ApiClient` callers get a consistent contract: they always get data or a rejected `ApiError`, never a silent `undefined`.
