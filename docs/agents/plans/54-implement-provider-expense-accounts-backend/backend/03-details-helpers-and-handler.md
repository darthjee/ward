# Details helpers and handler

Add pure helpers in `provider-expense-details.ts`, on the `debt-details.ts` pattern but without
modifying debt code:

- `ProviderExpenseState` / `ProviderExpenseResponse`, `defaultProviderExpenseState()`
  (`forAccountant: true`, `chargeFrequency: 'monthly'`, rest `null`), `providerExpenseStateOf(stored)`.
- `parseExpectedAmount(value, currency)` — `parseAmountInput` plus `<= 0n` → `400`
  (`provider_expense.expected_amount`).
- `rescaleProviderExpenseState(state, from, to)` — `convertAmountInput` on `expectedAmount`
  (no-op when `from === to` or `null`; `400` when not representable).
- `mergeProviderExpenseState(base, nested, currency)` — copies sent fields (`null` clears
  optional ones); if the merged frequency is `monthly`, a sent non-null `due_month` → `400`,
  otherwise `dueMonth = null`.
- `assertProviderExpensePairs(state)` — `yearly` with `dueMonth === null` → `400`.
- `serializeProviderExpenseState(state, currency)` — snake_case response with
  `formatAmount` for `expected_amount`.

Add `ProviderExpenseAccountHandler` (copy of `DebtAccountHandler`): `type = 'provider_expense'`,
`carriesLedger = true`, no-op `validateAccount`, `validateCreate` (defaults + merge + pairs),
`validateUpdate` (stored → rescale when `previousCurrency` is set and `expected_amount` not sent
→ merge → pairs), `loadDetails` (one `find` with `In(ids)`), `saveDetails` (upsert),
`serialize`. Register it in `bank.module.ts` (`providers` and the `ACCOUNT_TYPE_HANDLERS`
factory `inject` list). Update the comment in `account-type-handler.ts` that mentions
`provider_expense` as a future type.

Specs: a helpers spec and a handler spec covering every row of the issue's PATCH table, the
create-time rule on defaults (`{ charge_frequency: "yearly" }` alone → `400`), the
non-nullable fields, the `expected_amount` rescale (`200.00` BRL → `200` JPY; `12.50` BRL → JPY
→ `400`; sent value not rescaled and validated against the new currency; `null` clears), and
serialization of unset fields as `null`.

## Files to Change

- `backend/src/bank/account-types/provider-expense-details.ts` — new helpers.
- `backend/src/bank/account-types/provider-expense-account.handler.ts` — new handler.
- `backend/src/bank/account-types/account-type-handler.ts` — comment only.
- `backend/src/bank/bank.module.ts` — register the handler.
- `backend/src/bank/tests/provider-expense-details.spec.ts` — new spec.
- `backend/src/bank/tests/provider-expense-account.handler.spec.ts` — new spec.
