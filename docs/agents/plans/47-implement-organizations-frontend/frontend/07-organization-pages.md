# Organization pages and the Not-found view

Follow the page pattern `components/resources/<area>/pages/<Page>.jsx` +
`pages/controllers/<Page>Controller.js` (setters + injectable client) +
`pages/helpers/<Page>Helper.jsx` (`render(state, handlers)`), reusing `FormFieldsHelper` for the
name field and the submit-error alert.

- **`#/orgs/new` — `OrganizationNew`** (`org-new`): name field; validate with
  `validateOrganizationName`; on submit set `pending` (submit button `disabled` while pending),
  `OrganizationsClient.create(trimmedName)`, then `refreshOrgs()` and navigate to `#/orgs/<id>`.
  A 400 shows the backend message (`ApiError.message`); `pending` resets on error. Undefined
  result (session expired) → no navigation.
- **`#/orgs/:orgId` — `OrganizationOverview`** (`org-overview`): fetch
  `OrganizationsClient.show(context.orgId)` on each visit (exported `buildXEffect`); show the name,
  the user's role, and a Rename link to `contextHash(context, '/edit')`. Leave room for #49's bank
  links. A 404 → Not-found view and `ContextStorage.forgetIfMatches(userId, orgId)`.
- **`#/orgs/:orgId/edit` — `OrganizationEdit`** (`org-edit`): fetch on visit to prefill the name;
  rename via `OrganizationsClient.rename(orgId, name)`; then `refreshOrgs()` and navigate back to
  the overview (which refetches). Same validation, pending/disabled and 400 handling; 404 →
  Not-found + forget. Not linked from the switcher.
- The org id always comes from `useOwnerContext().context` (validated by the router), never from
  storage or a re-parse of the hash.
- **`NotFound`** (`components/common/notFound/`): one generic message plus a "Go to Personal" link to
  `#/`, identical for a malformed id (resolver `not-found`, no request sent; forget the remembered
  id if it equals the malformed segment's value — practically a no-op since stored ids are
  validated) and a backend 404. It never says whether the organization exists.
- Register `org-new`, `org-overview`, `org-edit` and `not-found` in `AppHelper`'s `PAGES`.
- Names and roles are React text only.

Specs: validation errors (empty, whitespace, 256 code points), backend 400 message shown, button
disabled while pending, create → navigates to the overview and calls `refreshOrgs`, rename → overview
and list refresh, overview renders name/role/Rename link, escaped name, Not-found for a 404 (and
remembered id forgotten) and for a malformed id (no `fetch` call), `AppHelperSpec` maps the new keys.

## Files to Change
- `frontend/assets/js/components/resources/organizations/pages/OrganizationNew.jsx` — new.
- `frontend/assets/js/components/resources/organizations/pages/OrganizationOverview.jsx` — new.
- `frontend/assets/js/components/resources/organizations/pages/OrganizationEdit.jsx` — new.
- `frontend/assets/js/components/resources/organizations/pages/controllers/*Controller.js` — new.
- `frontend/assets/js/components/resources/organizations/pages/helpers/*Helper.jsx` — new.
- `frontend/assets/js/components/common/notFound/NotFound.jsx` — new.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — register the new page keys.
- Matching specs under `frontend/specs/assets/js/...`.
