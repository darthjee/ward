# Register the Providers section, routes and menu entry

1. `common/sections.js`:
   - add `PROVIDERS_BASE = '/bank/providers'`;
   - add `['provider_expense', PROVIDERS_BASE]` to `SECTION_BY_TYPE`.
   This turns on the wrong-type redirects in every direction (detail and `/edit`), and
   `accountTypeGuard` stops answering notFound for `provider_expense`. Update the JSDoc and
   comments that list types in `accountTypeGuard.js`, `useAccountEditPage.js` and
   `useAccountList.js`.
2. `ROUTES_CONTEXT` in `utils/routing/routes.js`, in this order:
   - `['/bank/providers','bank-providers']`
   - `['/bank/providers/new','bank-provider-new']`
   - `['/bank/providers/accountant','bank-provider-accountant']`
   - `['/bank/providers/:accountId/edit','bank-provider-edit']`
   - `['/bank/providers/:accountId','bank-provider']`
   `/new` and `/accountant` come before `/:accountId`. Update the ordering JSDoc.
3. `SECTIONS_CONTEXT`: add `['/bank/providers','/bank/providers']`. The prefix match also
   covers `/bank/providers/accountant`, so switching context from the hand-off page lands on the
   Providers list.
4. `BANK_MENU_ENTRIES`: append `['Providers','/bank/providers']`.
5. `AppHelper.jsx` `PAGES`: add the five keys. Wire them as each page lands in steps 04, 05, 06
   and 08, or register them here with the page components created in those steps.
6. Specs:
   - `sectionsSpec` and `BankMenuHelperSpec` / `BankMenuSpec` (Providers after Investments);
   - `HashRouteResolverSpec`: `/new` and `/accountant` resolve before `:accountId`, in both
     contexts;
   - `sectionTargetSpec`, including from `/bank/providers/accountant` and
     `/orgs/5/bank/providers/3/edit`;
   - `AppHelperSpec`;
   - a new `providers/pages/providerDeepLinksSpec.js` modelled on
     `investmentDeepLinksSpec.js`: a provider account under `/bank/accounts`, `/bank/debts` or
     `/bank/investments` redirects to `<ui>/providers/:id`(`/edit`), and regular, debt and
     investment accounts under `/bank/providers/:id` redirect to their own path, in both
     contexts.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/sections.js` — `PROVIDERS_BASE` and type row
- `frontend/assets/js/components/resources/bank/common/detail/accountTypeGuard.js` — JSDoc wording
- `frontend/assets/js/utils/routing/routes.js` — five routes, section row
- `frontend/assets/js/components/common/header/bankMenu/helpers/BankMenuHelper.jsx` — Providers entry
- `frontend/assets/js/components/helpers/AppHelper.jsx` — page keys
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js`, `sectionTargetSpec.js`
- `frontend/specs/assets/js/components/common/header/bankMenu/...` (both specs), `.../helpers/AppHelperSpec.js`, `frontend/specs/assets/js/components/resources/bank/common/sectionsSpec.js`
- `frontend/specs/assets/js/components/resources/bank/providers/pages/providerDeepLinksSpec.js` (new)
