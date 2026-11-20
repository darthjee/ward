# Provider-expense details: drop schedule, write-through and 409

Shrink the provider-expense details to `for_accountant` + `provider_tax_id`, and remove the
transition write-through and its `409`.

## DTO

`backend/src/bank/dto/provider-expense-details.dto.ts`:

- Delete the seven schedule fields (L31-63).
- Move or keep `PROVIDER_CHARGE_FREQUENCIES`, which the provider-bill DTOs import, so they keep
  compiling.

The nested DTO is already wired with `@ValidateNested` / `@Type` in `create-account.dto.ts` and
`update-account.dto.ts`, and accounts use `@StrictBody()`. A nested `provider_expense.due_day`
therefore becomes a `400` with no extra code. Prove it with a test.

## Serializer

`backend/src/bank/account-types/provider-expense-details.ts`:

- Reduce `ProviderExpenseState`, `ProviderExpenseResponse`, `LoadedProviderExpense` and
  `COPIED_FIELDS` to the two remaining fields.
- Drop `EXPECTED_AMOUNT_FIELD`, `parseExpectedAmount`, the rescale of the details amount, the
  paired rule / `applyBillsFromLifecycle` in the merge, and `assertProviderExpensePairs`.
- `serializeProviderExpense` no longer reads `recurringBills`.
- Drop the `WithPayingAccount` usage here.

## Handler

`backend/src/bank/account-types/provider-expense-account.handler.ts`:

- Remove `SCHEDULE_KEYS`, `scheduleSentIn`, `#syncBills`, `#lockedRecurringBills`, the
  `providerHasMultipleBills` throw and its JSDoc, and the imports of `syncProviderBill`,
  `syncBillDescription`, `lockedRecurringBills` and `providerHasMultipleBills`.
- Keep `rescaleProviderBills` on a currency change. Keep `#remember` / `SAVE_CONTEXTS` only if
  the rescale still needs `previousCurrency`. Keep the provider lock if the rescale needs it.
- `loadDetails` drops the extra `ProviderBill` query and the `withPayingAccounts` call.
- Delete `backend/src/bank/account-types/provider-bill-write-through.ts`.

## Error code

Remove `PROVIDER_HAS_MULTIPLE_BILLS` from `backend/src/core/error-codes.ts` and remove
`providerHasMultipleBills()` from `backend/src/bank/provider-bill-conflicts.ts`.

## Validator gate

`backend/src/bank/account-schedule.validator.ts` must no longer run for `provider_expense`. Gate
the calls in `backend/src/bank/account.service.ts` (create ~L136, update ~L182) to the debt type,
or move the call into the debt handler. Debt behavior is unchanged. The `WithPayingAccount` type
stays in `account-types/schedule-fields.ts`, since debt and `bill-schedule.ts` still use it.

## Specs

- `backend/src/bank/tests/provider-expense-accounts.e2e-spec.ts`:
  - delete the write-through / reads / `409` block (L113-321);
  - keep the bill-rescale-on-currency-change tests, rewritten to create providers without a
    schedule and add bills via `/provider-bills.json`;
  - remove schedule fields from every request body and the validation / paired / rescale cases;
  - add these cases:
    - the response has no schedule keys;
    - sending any of the seven schedule keys nested in `provider_expense` gives `400` on create
      and on PATCH;
    - the `for_accountant` / `provider_tax_id` round-trip;
    - debt schedule fields are still accepted and returned, as a sanity check.
- `backend/src/bank/tests/bill-payments.e2e-spec.ts` and
  `backend/src/bank/tests/calendar.e2e-spec.ts`: their `provider()` helpers relied on the
  write-through. Create the provider plainly, then add a recurring bill via
  `POST /provider-bills.json` (the existing `addRecurring` helper). The pay/undo route changes
  belong to step 03.
- `backend/src/bank/tests/schedule-fields.e2e-spec.ts`: `TYPES` becomes `['debt']`.
- Unit specs: update
  - `provider-expense-account.handler.spec.ts` (drop write-through and `409`);
  - `provider-expense-details.spec.ts`;
  - `account.service.spec.ts`, including the validator gate, with a test that it is not called
    for providers;
  - `account-dtos.spec.ts`;
  - `account-type.registry.spec.ts:46`, to confirm it still passes;
  - `account-response.spec.ts` and `schedule-fields.spec.ts`, as needed.
- `accountant.e2e-spec.ts` stays unchanged and green.

## Files to Change

- `backend/src/bank/dto/provider-expense-details.dto.ts`: drop the schedule fields.
- `backend/src/bank/dto/create-provider-bill.dto.ts` and
  `backend/src/bank/dto/update-provider-bill.dto.ts`: frequency-constant import, if moved.
- `backend/src/bank/account-types/provider-expense-details.ts`: reduce state, response and merge
  to two fields.
- `backend/src/bank/account-types/provider-expense-account.handler.ts`: drop the write-through,
  the `409` and the bill reads in `loadDetails`.
- `backend/src/bank/account-types/provider-bill-write-through.ts`: delete.
- `backend/src/bank/provider-bill-conflicts.ts`: drop `providerHasMultipleBills`.
- `backend/src/core/error-codes.ts`: drop `PROVIDER_HAS_MULTIPLE_BILLS`.
- `backend/src/bank/account.service.ts`: run `account-schedule.validator` for debts only.
- `backend/src/bank/tests/provider-expense-accounts.e2e-spec.ts`,
  `backend/src/bank/tests/bill-payments.e2e-spec.ts` (provider helper),
  `backend/src/bank/tests/calendar.e2e-spec.ts` (provider helper) and
  `backend/src/bank/tests/schedule-fields.e2e-spec.ts`: as above.
- `backend/src/bank/tests/provider-expense-account.handler.spec.ts`,
  `backend/src/bank/tests/provider-expense-details.spec.ts`,
  `backend/src/bank/tests/account.service.spec.ts`,
  `backend/src/bank/tests/account-dtos.spec.ts`,
  `backend/src/bank/tests/account-type.registry.spec.ts`,
  `backend/src/bank/tests/account-response.spec.ts` and
  `backend/src/bank/tests/schedule-fields.spec.ts`: as above.
