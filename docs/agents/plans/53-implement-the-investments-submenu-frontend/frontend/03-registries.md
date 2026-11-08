# Register the Investments section, routes and menu entry

Wire the section into every registry. This turns on the wrong-type redirects in every
direction, through the existing `accountTypeGuard`.

- `B/common/sections.js`: add `INVESTMENTS_BASE = '/bank/investments'` and
  `['investment', INVESTMENTS_BASE]` in `SECTION_BY_TYPE` (`TYPE_BY_SECTION` is derived from it).
- `assets/js/utils/routing/routes.js`:
  - `ROUTES_CONTEXT` rows, with `new` before `:accountId`:
    - `['/bank/investments', 'bank-investments']`
    - `['/bank/investments/new', 'bank-investment-new']`
    - `['/bank/investments/:accountId/edit', 'bank-investment-edit']`
    - `['/bank/investments/:accountId', 'bank-investment']`
  - `SECTIONS_CONTEXT`: add `['/bank/investments', '/bank/investments']`, so switching context
    from an investments page lands on the Investments list. Update the comment that mentions #53.
- `assets/js/components/common/header/bankMenu/helpers/BankMenuHelper.jsx`: append
  `['Investments', '/bank/investments']` to `BANK_MENU_ENTRIES`.
- `assets/js/components/helpers/AppHelper.jsx`: add the four page keys to `PAGES`. Their
  components arrive in steps 04–06; land this step together with them, or wire it last.

Specs to update:
- `HashRouteResolverSpec.js` — the routes and their ordering.
- `sectionTargetSpec.js` — the switch target from investments pages, in both directions.
- `BankMenuHelperSpec.js` — it uses `toEqual` on the full array.
- `BankMenuSpec.js` — the entry is shown, with links built from the active context.
- `AppHelperSpec.js`.
- `sectionsSpec.js` — flip the "`investment` not registered" assertion.
- `accountTypeGuardSpec.js` — rewrite the `investment` → notFound cases into redirects:
  - an investment under `/bank/accounts/:id` or `/bank/debts/:id` → `/bank/investments/:id`
    (and with the `/edit` suffix);
  - a regular / debt account under `/bank/investments/:id` → its own path;
  - in both contexts.

## Files to Change
- `assets/js/components/resources/bank/common/sections.js` — `INVESTMENTS_BASE` and the type map
- `assets/js/utils/routing/routes.js` — `ROUTES_CONTEXT` / `SECTIONS_CONTEXT` rows
- `assets/js/components/common/header/bankMenu/helpers/BankMenuHelper.jsx` — the menu entry
- `assets/js/components/helpers/AppHelper.jsx` — the page mapping
- The specs listed above
