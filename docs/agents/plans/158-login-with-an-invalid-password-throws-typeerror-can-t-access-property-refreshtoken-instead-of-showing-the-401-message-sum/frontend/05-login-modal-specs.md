# Login modal end-to-end specs

Add a new spec file next to `LoginModalControllerDeniedSpec.js` (e.g.
`LoginModalControllerWrongPasswordSpec.js`). `LoginModalControllerSpec.js` is at the 300-line
limit. These cases use the **real** `AccountsClient` + `ApiClient` with `stubRefreshFlow` /
`fetchSequence` (from `specs/support/fetchSequence.js`) and `installFakeWindow`, so the whole
stack is exercised:

1. Wrong password, no stored refresh token (`stubRefreshFlow(..., { refreshToken: null })`, login
   answers `401 UNAUTHORIZED 'Invalid username or password'`): the submit error is
   `Invalid username or password`, no exception escapes, the modal is not closed,
   `AuthSession.clear` and `LoginModalEvents.open` are not called, and only one fetch was made.
2. Wrong password with a valid stored refresh token: same message, and `AuthSession.set` and
   `AuthSession.clear` are never called. Exactly one fetch was made (the login), so
   `/auth/refresh.json` was never requested and the token was not rotated.
3. `403 USER_DENIED` through the real client still shows `This account has been denied access.`

No production change is expected in `LoginModalController` or `LoginErrorMessages`. If a spec
shows otherwise, fix it there.

## Files to Change
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerWrongPasswordSpec.js` — new
