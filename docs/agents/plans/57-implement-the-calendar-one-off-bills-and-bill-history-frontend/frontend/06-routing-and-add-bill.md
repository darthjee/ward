# Routing, sections and the Add bill button

- `utils/routing/routes.js`:
  - `ROUTES_CONTEXT`: add `['/bank/bills/new', 'bank-bill-new']` and
    `['/bank/bills/:billId/edit', 'bank-bill-edit']` (context routes resolve under both `/bank`
    and `/orgs/:orgId/bank` through `HashRouteResolver`).
  - `SECTIONS_CONTEXT`: add a `/bank/bills` row landing on `/bank/providers` (the table the
    issue calls the "active-prefix table"; #77 may retarget it to the Calendar).
- `components/helpers/AppHelper.jsx`: map `bank-bill-new` / `bank-bill-edit` to the new pages.
- `BankProviderDetailHelper.jsx`: an **Add bill** link to
  `withHashQuery(contextHash(context, '/bank/bills/new'), { provider: account.id })`, hidden
  when the provider is archived.

Specs: both routes resolve under `/bank` and `/orgs/5/bank`; context switch from a bill page
lands on providers; AppHelper renders the pages; Add bill link href under both contexts and
hidden on archived providers.

## Files to Change
- `frontend/assets/js/utils/routing/routes.js` — route and section entries
- `frontend/assets/js/components/helpers/AppHelper.jsx` — page-key mapping
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderDetailHelper.jsx` — Add bill link
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js` — new routes
- `frontend/specs/assets/js/utils/routing/sectionTargetSpec.js` — bills section
- `frontend/specs/assets/js/components/helpers/AppHelperSpec.js` — new pages (if it exists)
- `frontend/specs/assets/js/components/resources/bank/providers/pages/helpers/BankProviderDetailHelperSpec.js` — Add bill link
