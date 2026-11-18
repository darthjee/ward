# Provider-expense details read side

Read the seven schedule fields of the nested `provider_expense` object from the provider's
recurring bills: `expected_amount`, `charge_frequency`, `due_day`, `due_month`, `bills_from`,
`show_in_calendar` and `paying_account`.

| Recurring bills | Source |
|---|---|
| Exactly one | That bill as stored. A bill hidden by a cleared `due_day` shows its last `due_day` with `show_in_calendar: false`. |
| Zero | The `bank_provider_expense_details` row, as today |
| Two or more | All seven fields are `null` |

- `ProviderExpenseAccountHandler.loadDetails`:
  - attach the recurring bills per provider in **one** batch query;
  - merge their paying-account refs into the existing `withPayingAccounts` batch;
  - do **not** overwrite the details fields, because `AccountService.update` uses the loaded
    details as its merge base;
  - store the bills on a separate property.
- `serialize` / `serializeProviderExpenseState` choose the source per the table above.
  `for_accountant` and `provider_tax_id` always come from the details row, and the
  `provider_expense` object is always present.
- `ProviderExpenseResponse` gets its own nullable `charge_frequency` and `show_in_calendar`
  fields. Do not change the shared `ScheduleResponse`, which debt uses.
- Optionally, let `CalendarQuery.sources` reuse the attached bills. It must still issue a single
  recurring-bill query either way.
- Tests:
  - `provider-expense-accounts.e2e-spec.ts`:
    - one bill edited through `provider-bills` is reflected;
    - a hidden bill after clearing `due_day`; update the existing expectations at ~l.162 and
      ~l.444–458;
    - zero bills with only `expected_amount`;
    - two recurring bills give all seven fields `null`;
    - the no-N+1 batch test (~l.626) is updated for one extra batch.
  - `provider-expense-account.handler.spec.ts`: source selection.

## Files to Change
- `backend/src/bank/account-types/provider-expense-account.handler.ts` — batch-load recurring bills, choose the source
- `backend/src/bank/account-types/provider-expense-details.ts` — nullable `charge_frequency` and `show_in_calendar`, serializer
- `backend/src/bank/account-types/account-refs.ts` — merge bill paying refs into the batch if needed
- `backend/src/bank/tests/provider-expense-accounts.e2e-spec.ts` — extend and update
- `backend/src/bank/tests/provider-expense-account.handler.spec.ts` — extend
