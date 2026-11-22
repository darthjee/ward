# Non-bank consumers: handle session-expired rejection

Apply the same rule outside the bank module. Use `isSessionExpired(error)` in each catch: reset
pending/loading state and show nothing. Remove the `!result` / `undefined` guards and their
"expired session" JSDoc.

- `components/resources/accounts/pages/controllers/AuthorizationRequestsController.js`: in
  `load` (`setLoadError`) and `#performRowAction` (row error).
- `components/common/forms/controllers/AccountEditFormController.js`: `#send`/`handleSubmitError`
  (`setSubmitError`). This also covers `MyAccountController`/`AdminUserEditController` save paths.
- `components/resources/accounts/pages/controllers/MyAccountController.js`: `load`, which reads
  `account.username`. It used to crash on `undefined`.
- `components/resources/organizations/pages/controllers/OrganizationLoader.js`: catch, which
  calls `onError(error.message)`.
- `components/resources/organizations/pages/controllers/OrganizationFormController.js`: catch,
  which calls `setSubmitError`.
- `components/common/ownerContext/controllers/OrgListController.js` `#fetchState`: on session
  expiry return `null` (stay unloaded), not `orgsError`.
- `components/resources/admin/pages/controllers/AdminUsersController.js`: `#handleTopLevelError`
  and `#handleRowError` skip session expiry, next to the existing `redirectIfForbidden` check.

No change is needed in `DisplayLocaleLoader` (it swallows errors), `HeaderController` (it
swallows logout errors), `AwaitingApprovalController` (`status` is now public, so a 401 is a
real check failure), `RegisterController`, or the LoginModalController register/reset/device
paths (all public, so showing `error.message` is correct).

Specs: migrate the `undefined`-resolve cases to session-expired rejections in
`AuthorizationRequestsControllerSpec`, `AccountEditFormControllerSpec`,
`support/accountEditFormControllerExamples.js`, `MyAccountControllerSpec`, `OrganizationLoaderSpec`,
`OrganizationNewControllerSpec`/`OrganizationFormControllerSpec`, `OrgListControllerSpec` and
`AdminUsersControllerSpec`. Each asserts that no error message is set.

## Files to Change
- The controllers listed above under `frontend/assets/js/components/`
- Their specs under `frontend/specs/assets/js/components/` and `frontend/specs/support/accountEditFormControllerExamples.js`
