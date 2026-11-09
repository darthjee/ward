# Providers list page

`<ui>/providers`. `BankProviderList.jsx` uses `useAccountList('provider_expense')` and
renders through `BankProviderListHelper`.

- Columns:
  - name;
  - provider (`bank_name`);
  - current balance (`formatMoney`);
  - expected amount with frequency, through `formatInstalment` (e.g. "R$ 200,00 / month",
    "/ year"), with "—" when `expected_amount` is null;
  - for-accountant marker (e.g. "Yes" / "—" or a badge);
  - currency.
- No grand total, sorted by name, no pagination.
- `ArchivedBadge` on archived rows. *Show archived* toggle through `AccountListHeader`
  (title "Providers", **New provider**), with an **Accountant hand-off** link
  (`contextHash(context, '/bank/providers/accountant')`) in the new header slot.
- Empty state: `EmptyAccountList` with "No providers yet" and a create button.
- A row opens `<ui>/providers/:id`.
- Put shared label lookups (frequency suffix, for-accountant text) in
  `providers/common/providerLabels.js`, a pure module with its own spec.

Specs cover: the list asks for `type=provider_expense`; the columns and formatting (including
"—" and "/ year"); the archived toggle; the empty state; the hand-off link; both contexts; and
escaped names.

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/pages/BankProviderList.jsx` (new)
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderListHelper.jsx` (new)
- `frontend/assets/js/components/resources/bank/providers/common/providerLabels.js` (new)
- `frontend/assets/js/components/helpers/AppHelper.jsx` — wire `bank-providers`
- `frontend/specs/assets/js/components/resources/bank/providers/pages/BankProviderListSpec.js`, `frontend/specs/assets/js/components/resources/bank/providers/pages/helpers/BankProviderListHelperSpec.js`, `frontend/specs/assets/js/components/resources/bank/providers/common/providerLabelsSpec.js` (new)
