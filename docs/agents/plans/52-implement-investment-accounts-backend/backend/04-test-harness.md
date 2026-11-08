# Test harness and stale fixtures
Make the e2e/unit harness aware of investment details, and fix specs that use `investment` as
"a type without a handler" (they break once it is registered) — switch them to a still
unsupported type such as `provider_expense`.

- `tests/support/in-memory-bank-repos.ts`: add an in-memory investment-details repo (or
  generalise `createInMemoryDebtDetailsRepo()` into `createInMemoryDetailsRepo()`), keyed by
  `accountId` with a `findCalls` counter; add it to `InMemoryBankRepos`; make the
  `accounts.delete` cascade prune investment rows too.
- `tests/support/build-bank-test-app.ts`: `repositoryFor` returns the investment repo for
  `InvestmentDetails`.
- Stale fixtures: `tests/accounts.e2e-spec.ts` (~line 177 create with `type: 'investment'`,
  ~line 274 `GET ?type=investment` → 400), `tests/account.service.spec.ts` (~line 165
  `it.each(['debt','investment','nope'])`), `tests/account-type.registry.spec.ts` (~lines 14,
  22 `get('investment')` expected to throw).

## Files to Change
- `backend/src/bank/tests/support/in-memory-bank-repos.ts` — investment details repo + cascade
- `backend/src/bank/tests/support/build-bank-test-app.ts` — `repositoryFor` mapping
- `backend/src/bank/tests/accounts.e2e-spec.ts` — replace `investment` as unsupported type
- `backend/src/bank/tests/account.service.spec.ts` — replace `investment` as unsupported type
- `backend/src/bank/tests/account-type.registry.spec.ts` — replace `investment` as unsupported type
