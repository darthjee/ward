# 403 handling and role refresh

Classify the backend's 403 as its own error kind, render the permission message, and
refresh the shared role so that stale controls disappear.

- **Event bus:** create `client/PermissionEvents.js`, modelled on `AuthEvents.js` /
  `LoginModalEvents.js`, with `onForbidden(listener) → unsubscribe` and `emitForbidden()`.
- **`ApiClient`:** in `client/ApiClient.js`, when a response status is 403, call
  `PermissionEvents.emitForbidden()` before rejecting with the `ApiError`. The 401 behaviour
  is unchanged.
- **Provider subscription:** `OwnerContextProvider` subscribes in an effect, calls
  `refreshOrgs()` on each event and unsubscribes on unmount.
  - Follow the existing controller pattern, so that the effect can be exercised from specs
    (for example an exported `buildForbiddenRefreshEffect`).
  - Rapid repeated 403s may simply trigger repeated refreshes. That is acceptable; add a
    simple in-flight guard only if `OrgListController` does not already have one.
- **`classifyError`:** in `components/resources/bank/common/bankErrors.js`, add a
  `forbidden` kind for `ApiError` with `status === 403`. Its `messages` holds the permission
  message, and it must be checked before the `transient` fallback.
- **Permission message constant:** export `PERMISSION_DENIED_MESSAGE = "You don't have
  permission to do this"`. Put it in `components/common/PermissionDenied.jsx` (created here;
  step 05 reuses it) or a small constants module next to it.
- **`BankErrorAlert`:** render the `forbidden` kind as a plain alert with the permission
  message and no Retry. Through the generic `messages` branch is fine, provided no Retry
  appears.
- **Organization rename:** in `OrganizationEditController.handleSubmitError`, map status 403
  to the permission message instead of falling through to `error.message` ("Forbidden").
- Specs:
  - `ApiClient` emits on 403 and does not emit on other statuses.
  - The `PermissionEvents` subscribe/emit/unsubscribe cycle works.
  - The provider effect calls `refreshOrgs` on the event and unsubscribes on cleanup.
  - `classifyError` returns `forbidden` for 403.
  - `BankErrorAlert` renders the permission message and no Retry for `forbidden`.
  - The rename shows the permission message on 403.
  - One bank controller (for example `LedgerFormController` for a payment-generated
    transaction edit) surfaces `forbidden`.

## Files to Change
- `frontend/assets/js/client/PermissionEvents.js`: new event bus.
- `frontend/assets/js/client/ApiClient.js`: emit on 403.
- `frontend/assets/js/components/common/ownerContext/OwnerContextProvider.jsx`: subscribe and
  call `refreshOrgs`.
- `frontend/assets/js/components/common/PermissionDenied.jsx`: message constant (and the
  component used in step 05).
- `frontend/assets/js/components/resources/bank/common/bankErrors.js`: `forbidden` kind.
- `frontend/assets/js/components/resources/bank/common/BankErrorAlert.jsx`: render
  `forbidden`.
- `frontend/assets/js/components/resources/organizations/pages/controllers/OrganizationEditController.js`:
  map 403.
- The matching specs under `frontend/specs/assets/js/`: `client/`, `components/common/`,
  `components/resources/bank/common/` and `components/resources/organizations/pages/`.
