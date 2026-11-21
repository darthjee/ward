# Admin-only pages by URL

When a `user` reaches an admin-only page directly by URL, render the plain "You don't have
permission to do this" message instead of the form.

- Implement `components/common/PermissionDenied.jsx`. It is a small presentational component
  that renders `PERMISSION_DENIED_MESSAGE` (created in step 03), matching the existing
  alert/`NotFound` styling.
- **Bank account forms:** in `bank/common/form/hooks/useAccountNewPage.js` and
  `useAccountEditPage.js`, read the context role.
  - Expose `forbidden = role !== null && !can(role, ACTIONS.MANAGE_ACCOUNTS)`.
  - While the role is `null`, keep the page in its loading state.
  - Do not issue the edit page's load request when the page is forbidden.
  - In each page, branch early next to the existing `if (notFound) return <NotFound/>`:
    `if (forbidden) return <PermissionDenied/>`.
  - The pages are `BankAccountNew.jsx`, `BankAccountEdit.jsx`, `BankDebtNew.jsx`,
    `BankDebtEdit.jsx`, `BankInvestmentNew.jsx`, `BankInvestmentEdit.jsx`,
    `BankProviderNew.jsx` and `BankProviderEdit.jsx`.
- **Organization rename:** in `organizations/pages/OrganizationEdit.jsx`, render
  `<PermissionDenied/>` when the role is known and
  `!can(role, ACTIONS.RENAME_ORGANIZATION)`.
- Specs:
  - `PermissionDenied` renders the message.
  - For each of the nine pages: `user` sees the message and no form.
  - `admin` and `owner` see the form.
  - In personal context the form is shown.
  - A `null` role shows neither the message nor the form, only the loading state.
  - Reuse the shared `accountEdit*Examples.js` where they fit.

## Files to Change
- `frontend/assets/js/components/common/PermissionDenied.jsx`: the component.
- `frontend/assets/js/components/resources/bank/common/form/hooks/useAccountNewPage.js` and
  `useAccountEditPage.js`: the `forbidden` flag.
- `frontend/assets/js/components/resources/bank/accounts/pages/BankAccountNew.jsx` and
  `BankAccountEdit.jsx`: early branch.
- `frontend/assets/js/components/resources/bank/debts/pages/BankDebtNew.jsx` and
  `BankDebtEdit.jsx`: early branch.
- `frontend/assets/js/components/resources/bank/investments/pages/BankInvestmentNew.jsx` and
  `BankInvestmentEdit.jsx`: early branch.
- `frontend/assets/js/components/resources/bank/providers/pages/BankProviderNew.jsx` and
  `BankProviderEdit.jsx`: early branch.
- `frontend/assets/js/components/resources/organizations/pages/OrganizationEdit.jsx`: early
  branch.
- The matching specs under `frontend/specs/assets/js/components/` (including
  `organizations/pages/OrganizationPagesSpec.js`).
