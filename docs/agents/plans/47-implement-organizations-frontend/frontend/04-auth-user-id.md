# Carry `userId` through the auth status flow

The backend's logged-in `POST /auth/status.json` answer now includes `userId` (number). The frontend
needs it to key `ward.context.<userId>`.

- `AccountsClient.status`: update the JSDoc for the new field (no behaviour change).
- `AuthStatus.refresh`: on `loggedIn`, pass `userId` on; every other branch emits no user id.
- `AuthEvents.emit`: add `userId` to the event `detail` (`{ loggedIn, isAdmin, pending, userId }`,
  `userId` `null` unless logged in). Prefer adding a 4th positional argument defaulting to `null` so
  existing `emit(false, false)` calls (e.g. `HeaderController.handleLogout`) stay valid.
- `useAuthEffect` / `buildAuthEffect`: accept an optional `setUserId` setter and pass the id through;
  `Header` keeps its own `loggedIn` / `isAdmin` / `pending` state as today.

Specs: `AuthStatusSpec` (logged-in emits the `userId`; pending / logged-out emit `null`),
`AuthEventsSpec` (detail carries `userId`, default `null`), `useAuthEffectSpec` (setter called).

## Files to Change
- `frontend/assets/js/client/AccountsClient.js` — `status` JSDoc.
- `frontend/assets/js/client/AuthStatus.js` — pass `userId`.
- `frontend/assets/js/client/AuthEvents.js` — `userId` in `detail`.
- `frontend/assets/js/components/common/header/hooks/useAuthEffect.js` — optional `setUserId`.
- `frontend/specs/assets/js/client/AuthStatusSpec.js`, `frontend/specs/assets/js/client/AuthEventsSpec.js`, `frontend/specs/assets/js/components/common/header/hooks/useAuthEffectSpec.js` — new cases.
