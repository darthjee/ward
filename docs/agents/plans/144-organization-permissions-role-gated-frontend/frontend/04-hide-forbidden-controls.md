# Hide forbidden controls

Stop rendering, in an organization context, the links, buttons and menu items that the
caller's role cannot use. In personal context the role is `owner`, so nothing changes there.

Each helper receives a boolean (for example `canManageAccounts`, `canDelete`, `canUndo`),
computed with `can(role, ACTIONS.X)` or `useCan(ACTIONS.X)` in the page or component that
already reads the owner context. Pass the boolean through the existing helper props or state
rather than reading the context deep inside pure helpers. That keeps helpers testable with
plain arguments. Never compare roles inline.

**Account header** (`bank/common/detail/helpers/AccountHeaderHelper.jsx`), shared by the
account, debt, investment and provider detail pages:
- Edit/Rename link: requires `MANAGE_ACCOUNTS`.
- `renderArchiveButton` (Archive/Unarchive): requires `MANAGE_ACCOUNTS`.
- `renderDeleteButton`: requires `DELETE`.

**Create-account links:**
- `bank/common/list/AccountListHeader.jsx`: the New button.
- The empty-state links passed to `EmptyAccountList` from `BankAccountListHelper.jsx`,
  `BankDebtListHelper.jsx`, `BankInvestmentListHelper.jsx` and `BankProviderListHelper.jsx`.

All of these require `MANAGE_ACCOUNTS`. When the link is hidden, the empty state keeps its
text but shows no link.

**Ledger** (`bank/common/detail/helpers/LedgerTableHelper.jsx` `renderActions`):
- Delete requires `DELETE`.
- Edit stays visible, because payment-generated rows cannot be detected (see the Notes in
  `frontend.md`).

**Undo payment:**
- `bank/common/bills/helpers/BillHistoryHelper.jsx` `renderUndo`.
- `bank/calendar/common/CalendarEntry.jsx` `EntryActions`, the Undo button only.

Both require `UNDO_PAYMENT`. Pay and Skip stay.

**Provider bills:**
- `bank/providers/common/helpers/ProviderBillsHelper.jsx` `renderEditDelete`: Delete
  requires `DELETE`; Edit stays.
- `bank/bills/pages/helpers/BankBillFormHelper.jsx` `renderDelete`: fold the role check into
  `state.canDelete` (or its computation in `BillFormController` / `BankBillEdit.jsx`), so
  that it also requires `DELETE`.

**Organization overview**
(`organizations/pages/helpers/OrganizationOverviewHelper.jsx`):
- The Rename link requires `RENAME_ORGANIZATION`.
- It may use the role returned by `OrganizationsClient.show` (already loaded by the page),
  or the context role. Prefer the context role for consistency with the rest of the UI.

Specs (extend the existing specs for each helper and page):
- For `user`, each gated control is absent.
- For `admin` and `owner`, each gated control is present.
- In personal context nothing is hidden.
- Ungated controls (Pay, Skip, ledger Edit, provider-bill Edit, Add shortcuts) stay
  present for `user`.

Use the existing `OwnerContext.Provider` injection pattern and the `renderedOutput.js`
helpers.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/detail/helpers/AccountHeaderHelper.jsx`:
  gate Edit, Archive/Unarchive and Delete.
- The callers that compute and pass the flags:
  `bank/accounts/pages/helpers/BankAccountHeaderHelper.jsx`,
  `bank/accounts/pages/helpers/BankAccountDetailHelper.jsx`,
  `bank/debts/pages/helpers/BankDebtDetailHelper.jsx`,
  `bank/investments/pages/helpers/BankInvestmentDetailHelper.jsx` and
  `bank/providers/pages/helpers/BankProviderDetailHelper.jsx`, plus their pages.
- `frontend/assets/js/components/resources/bank/common/list/AccountListHeader.jsx`: gate the
  New button.
- `bank/accounts/pages/helpers/BankAccountListHelper.jsx`,
  `bank/debts/pages/helpers/BankDebtListHelper.jsx`,
  `bank/investments/pages/helpers/BankInvestmentListHelper.jsx` and
  `bank/providers/pages/helpers/BankProviderListHelper.jsx`: gate the empty-state links.
- `frontend/assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelper.jsx`:
  gate Delete.
- `frontend/assets/js/components/resources/bank/common/bills/helpers/BillHistoryHelper.jsx`:
  gate Undo.
- `frontend/assets/js/components/resources/bank/calendar/common/CalendarEntry.jsx`: gate
  Undo.
- `frontend/assets/js/components/resources/bank/providers/common/helpers/ProviderBillsHelper.jsx`:
  gate Delete.
- `frontend/assets/js/components/resources/bank/bills/pages/helpers/BankBillFormHelper.jsx`,
  `bills/pages/controllers/BillFormController.js` and `bills/pages/BankBillEdit.jsx`: gate
  Delete.
- `frontend/assets/js/components/resources/organizations/pages/helpers/OrganizationOverviewHelper.jsx`:
  gate the Rename link.
- The matching specs under `frontend/specs/assets/js/components/resources/`.
