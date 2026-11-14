# My account: pre-fill and Display locale select

*My account* (`components/resources/accounts/pages/MyAccount.jsx`, `MyAccountController`,
`MyAccountHelper`) is built on the shared account-edit pieces
(`components/common/forms/controllers/AccountEditFormController.js`,
`hooks/useAccountEditForm.js`, `helpers/AccountEditFormHelper.jsx`) also used by *Admin user
edit*. Keep admin behaviour unchanged: put the new behaviour in `MyAccount*` overrides or behind
opt-in hooks/options on the shared pieces.

- **Pre-fill.** On mount, call `AccountsClient.getAccount()` and fill `username`, `email` and
  `locale`; remember the loaded values as the baseline. While loading, show the form disabled
  (or a loading state); on failure, show the existing error alert and keep blank fields.
- **Select.** Add a *Display locale* `<select>` built from `DISPLAY_LOCALES` (Browser default
  first, value `''` ↔ `null`), placed with the profile fields. Labels are fixed English/endonym
  strings from `locales.js`, no translation.
- **Payload.** Build it from **changes against the baseline**, not from non-blank fields
  (pre-filling would otherwise always send `username`/`email` and demand a password): send
  `username` / `email` only when they differ from the loaded values, `newPassword` when set,
  `locale` (possibly `null`) only when it differs. `AccountsClient.updateAccount` must send
  `currentPassword` only when defined and pass `locale` through, including `null` (extend
  `pickDefined` usage accordingly).
- **Validation.** `hasUpdate` is true when any of username / email / newPassword / locale
  changed. `currentPassword` is required only when username, email or newPassword changed; a
  locale-only change submits without it.
- **Success.** `applySuccess` writes back `username`, `email`, `locale` from the response,
  resets the baseline, clears password fields, and calls `DisplayLocale.set(response.locale)` so
  every formatted value updates immediately without a reload.
- **Errors.** Map `422 INVALID_LOCALE` to the select's field error ("Unsupported display
  locale"); the other errors behave as today.

Specs (`MyAccountSpec`, `MyAccountControllerSpec`, `MyAccountHelperSpec`, the shared
`accountEdit*Examples`, `useAccountEditFormSpec`, `AccountEditFormControllerSpec`):

- fields are pre-filled from `getAccount`; select shows the loaded locale, Browser default for
  `null`;
- changing only the locale submits `{ locale: 'pt-BR' }` with no `currentPassword` and no
  username/email, and `DisplayLocale.get()` is `pt-BR` afterwards; choosing Browser default
  sends `{ locale: null }`;
- an unchanged pre-filled form has no update; changing username still requires
  `currentPassword`;
- after saving `pt-BR`, a rendered amount/date helper shows the `pt-BR` format without reload;
- admin user edit specs unchanged (no select, no pre-fill change).

## Files to Change

- `frontend/assets/js/components/resources/accounts/pages/MyAccount.jsx`
- `frontend/assets/js/components/resources/accounts/pages/controllers/MyAccountController.js`
- `frontend/assets/js/components/resources/accounts/pages/helpers/MyAccountHelper.jsx`
- `frontend/assets/js/components/common/forms/hooks/useAccountEditForm.js` — optional load step / baseline
- `frontend/assets/js/components/common/forms/controllers/AccountEditFormController.js` — overridable `hasUpdate` / payload-from-baseline hooks
- `frontend/assets/js/components/common/forms/helpers/AccountEditFormHelper.jsx` — slot for the select
- `frontend/assets/js/client/AccountsClient.js` — `updateAccount` passes `locale`, optional `currentPassword`
- `frontend/specs/assets/js/components/resources/accounts/pages/MyAccountSpec.js`
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/MyAccountControllerSpec.js`
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/MyAccountHelperSpec.js`
- `frontend/specs/assets/js/components/common/forms/**/*Spec.js` and `frontend/specs/support/accountEdit*Examples.js` as needed
- `frontend/specs/assets/js/client/AccountsClientSpec.js`
