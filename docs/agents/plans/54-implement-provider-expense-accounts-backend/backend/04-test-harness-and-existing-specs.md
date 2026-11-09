# Test harness and existing specs

Teach the in-memory bank test harness about the new details table, and update the specs that
used `provider_expense` as the example of a type without a handler.

Harness:

- `in-memory-bank-repos.ts` — `providerExpenseDetails: createInMemoryDetailsRepo(ProviderExpenseDetails)`,
  its type in `InMemoryBankRepos`, and in the cascade loop of `accounts.delete`.
- `build-bank-test-app.ts` — `fakeDataSource` returns `repos.providerExpenseDetails` for the
  entity.

"Type without a handler" specs (keep the unknown-type cases `savings`, `nope`, `''`):

- `accounts.e2e-spec.ts` ~line 177 — drop the `['a type without a handler', { type: 'provider_expense' }]`
  row; ~line 274 — replace `?type=provider_expense` with an unknown type (and rename the test).
- `account.service.spec.ts` ~line 168 — drop `provider_expense` from the rejected list; add a
  describe with a registry of all four handlers covering provider-expense create / update
  through the service (nested object routed by type, foreign nested object rejected).
- `account-type.registry.spec.ts` — reduce "rejects %p (no handler)" to unknown types; replace
  the `get('provider_expense')` throws in the debt / investment cases with a four-handler
  registry resolving all four types; add `assertNoForeignNested` cases for `provider_expense`
  (object on another type → `400`; `debt` / `investment` object on a provider account → `400`).
- `account-response.spec.ts` — the nested `provider_expense` key is serialized only for
  provider-expense accounts.

Other types' existing specs must pass unchanged otherwise.

## Files to Change

- `backend/src/bank/tests/support/in-memory-bank-repos.ts` — new repo and cascade.
- `backend/src/bank/tests/support/build-bank-test-app.ts` — `fakeDataSource` mapping.
- `backend/src/bank/tests/accounts.e2e-spec.ts` — remove `provider_expense` from the 400 cases.
- `backend/src/bank/tests/account.service.spec.ts` — remove from 400 cases, add four-handler
  describe.
- `backend/src/bank/tests/account-type.registry.spec.ts` — four types resolve, foreign-nested
  cases.
- `backend/src/bank/tests/account-response.spec.ts` — serialization case.
