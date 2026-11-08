# Menu entry, routes, sections and page keys

- `BANK_MENU_ENTRIES`: append `['Debts', '/bank/debts']` after Accounts.
- `ROUTES_CONTEXT`: add, keeping `new` before `:accountId` (same ordering rule as Accounts):
  `['/bank/debts', 'bank-debts']`, `['/bank/debts/new', 'bank-debt-new']`,
  `['/bank/debts/:accountId/edit', 'bank-debt-edit']`, `['/bank/debts/:accountId', 'bank-debt']`.
- `SECTIONS_CONTEXT`: add `['/bank/debts', '/bank/debts']` so switching context from any debts
  page lands on the Debts list.
- `AppHelper.jsx`: map the four page keys to the new pages (steps 05–07). Land this step
  together with stub/real pages so the app never references missing components.

Specs: `BankMenuHelperSpec` / `BankMenuSpec` (Debts entry, links built from the active context
in both contexts); `HashRouteResolverSpec` `bank routes` (each debts route resolved as `#path`
and `#/orgs/5path`, `bank-debt-new` before `bank-debt`); `sectionTargetSpec` (row present,
debts hashes in both contexts map to the Debts list); `AppHelperSpec` (new keys).

## Files to Change
- `components/common/header/bankMenu/helpers/BankMenuHelper.jsx` — Debts entry
- `utils/routing/routes.js` — debts routes and section row
- `components/helpers/AppHelper.jsx` — page keys
- `frontend/specs/assets/js/components/common/header/bankMenu/…Spec.js`, `utils/routing/HashRouteResolverSpec.js`, `utils/routing/sectionTargetSpec.js`, `components/helpers/AppHelperSpec.js`
