# Display locale store and loading

The formatting helpers are pure functions called from static `XHelper.render(state)` objects,
so a React context would have to be threaded everywhere. Use a module-level store instead
(precedent: `utils/context/ContextStorage.js`).

- `utils/locale/locales.js` — `DISPLAY_LOCALES`: the ordered `{ value, label }` list from the
  contract (first entry `{ value: null, label: 'Browser default' }`), and
  `isDisplayLocale(value)`.
- `utils/locale/DisplayLocale.js` — `get()` returns the stored locale or `undefined` (so
  callers pass it straight to `Intl`, `undefined` meaning browser default); `set(locale)`
  stores an allowlisted value or clears on `null`/unknown, and notifies subscribers only when
  the value changes; `subscribe(fn)` / `unsubscribe(fn)`. In memory only, no `localStorage`:
  before the account loads and when logged out, the browser default applies.
- `client/AccountsClient.js` — `getAccount()` → `ApiClient.getJson('/auth/account.json')`.
- Loading: a `utils/locale/DisplayLocaleLoader.js` subscribing to `AuthEvents`: on
  `loggedIn: true` call `AccountsClient.getAccount()` and `DisplayLocale.set(account.locale)`;
  on `loggedIn: false` (logout, pending, denied, expiry) `DisplayLocale.set(null)`. A failed GET
  leaves the browser default and does not surface an error. Guard against an out-of-order
  response (a GET resolving after a logout must not re-apply the old locale). Start it once from
  the app entry point (`App.jsx` or the bootstrap module), since `AuthStatus.refresh` already
  emits on mount, after login, register and the device-authorization win.
- Re-render without reload: `App.jsx` subscribes to `DisplayLocale` (a small
  `useDisplayLocale` hook holding the value in state) so a change re-renders the tree. Do not
  remount via a `key` (it would reset open forms). If any component under it is memoised and
  shows formatted values, make it depend on the locale too.

Specs: store get/set/clear/notify-only-on-change/unknown value; loader sets on login, clears
on logout, ignores a late response after logout, keeps the default on GET failure;
`AccountsClient.getAccount` calls the right URL; the hook re-renders on change.

## Files to Change

- `frontend/assets/js/utils/locale/locales.js` — new
- `frontend/assets/js/utils/locale/DisplayLocale.js` — new
- `frontend/assets/js/utils/locale/DisplayLocaleLoader.js` — new
- `frontend/assets/js/utils/locale/useDisplayLocale.js` — new hook
- `frontend/assets/js/client/AccountsClient.js` — `getAccount()`
- `frontend/assets/js/App.jsx` (or the app entry module) — start the loader, subscribe
- `frontend/specs/assets/js/utils/locale/*Spec.js` — new specs
- `frontend/specs/assets/js/client/AccountsClientSpec.js`
