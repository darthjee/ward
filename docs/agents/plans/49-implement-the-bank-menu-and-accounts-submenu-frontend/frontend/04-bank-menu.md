# Bank menu in the header

Add a **Bank** `NavDropdown` to the header's left nav, after the `ContextSwitcher`.

- New component `components/common/header/bankMenu/BankMenu.jsx` (+ `helpers/BankMenuHelper.jsx`),
  following the `ContextSwitcher` precedent: it calls `useOwnerContext()` and receives
  `loggedIn` / `pending`; it renders nothing unless logged in and approved (not pending).
- Entries come from an ordered list in the helper (only `['Accounts', '/bank/accounts']` for
  #49; #51/#53/#55/#57 append theirs). Each `NavDropdown.Item href` is
  `contextHash(context, path)` — `#/bank/accounts` or `#/orgs/:orgId/bank/accounts`. No
  disabled or stub entries.
- Import react-bootstrap via the `react-bootstrap/cjs/NavDropdown.js` path, with
  `renderMenuOnMount` so the static-markup specs see the items.
- Render `<BankMenu loggedIn pending />` from `HeaderHelper.jsx`.

Specs (`ui/menu.md` items in scope): hidden logged out and pending; Accounts link built from the
active context in Personal and in an organization; works in Personal with zero organizations
(empty `orgs`).

## Files to Change
- `frontend/assets/js/components/common/header/bankMenu/BankMenu.jsx` — new
- `frontend/assets/js/components/common/header/bankMenu/helpers/BankMenuHelper.jsx` — new
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — render the Bank menu in the left nav
- `frontend/specs/assets/js/components/common/header/bankMenu/BankMenuSpec.js` — new
- `frontend/specs/assets/js/components/common/header/helpers/HeaderHelperSpec.js` — Bank menu presence / gating, if the existing spec covers the left nav
