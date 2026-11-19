# Wire the Bills block into the provider detail

Add an optional `renderAfterHeader` slot to `AccountDetailHelper.renderLoaded`, rendered right
after the header and before the "Ledger" heading. Callers that don't pass the slot render
exactly as before.

`BankProviderDetailHelper` passes the slot, and it renders
`<ProviderBills context=… account={account} />`.

Remove the provider-level schedule entries from `ProviderInfoHelper`: Expected amount,
Frequency, Due day / month and `ScheduleInfoHelper.render(account.provider_expense)`. The
Bills block now shows them per bill. Keep `for_accountant` and `provider_tax_id`.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx`:
  add the `renderAfterHeader` slot.
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderDetailHelper.jsx`:
  render `ProviderBills` in the new slot.
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/ProviderInfoHelper.jsx`:
  drop the schedule entries.
- Specs: `AccountDetailHelperSpec` (the slot renders when given and is absent otherwise),
  `BankProviderDetailHelperSpec` / `BankProviderDetailSpec` (the Bills block renders) and
  `ProviderInfoHelperSpec` (no schedule entries).
