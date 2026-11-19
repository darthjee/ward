# Unit, e2e and integration specs

**Unit**
- `account-type.registry.spec.ts`: `listExtras` calls the hook once per type that implements
  it, skips types without it, and returns an empty map for an empty list.
- `provider-expense-account.handler.spec.ts`: the mapping to `bills_summary`, including the
  zero default and formatting at the currency's exponent (BRL `"0.00"`, JPY `"0"`).
- `account-response.spec.ts`: `extra` is merged at the top level.
- `account.service.spec.ts`: `list()` passes the extras through, while `find()`, create,
  update, archive and unarchive do not call `listExtras`. If a presenter was extracted, add a
  spec for it and move the presentation tests there.

**E2E** (`provider-expense-accounts.e2e-spec.ts`, list section, for both `CONTEXTS`)
- A provider with recurring monthly bills (one with a null `expected_amount`), a recurring
  yearly bill and a one-off. `count` includes all of them. `monthly` and `yearly` sum only the
  recurring bills with amounts.
- A provider with no bills gets `{ count: 0, monthly: "0.00", yearly: "0.00" }`.
- An archived provider carries `bills_summary` in `archived=true` lists.
- Other types (`regular`, `debt`, `investment`) have no `bills_summary`.
  `GET accounts/:id.json` has none either.
- No N+1: with several providers, `ProviderBillsSummaryQuery.groupedCalls` grows by exactly 1
  per list request.
- `ownerKeysIn` finds no owner or organization id in `bills_summary`.
- **Invalidation pin**: after a provider-bill POST, PATCH and DELETE, `x-cache-invalidate`
  equals `base(orgId)`, which is a prefix of the `accounts.json` path, and a following
  `GET accounts.json?type=provider_expense` shows the updated `bills_summary`.
- Add `jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'))`
  to every bank e2e spec that builds the bank app.

**Integration (MySQL)**
- In `backend/src/database/tests/integration/provider-bills.integration-spec.ts` (or a new
  sibling), run the real `ProviderBillsSummaryQuery` against seeded bills. Cover count, the
  per-frequency sums, skipped nulls and one-offs, missing ids, and an empty id list.

## Files to Change
- `backend/src/bank/tests/account-type.registry.spec.ts`
- `backend/src/bank/tests/provider-expense-account.handler.spec.ts`
- `backend/src/bank/tests/account-response.spec.ts`
- `backend/src/bank/tests/account.service.spec.ts` (and a presenter spec, if one was extracted)
- `backend/src/bank/tests/provider-expense-accounts.e2e-spec.ts` — the summary, no-N+1, privacy and invalidation tests
- `backend/src/bank/tests/*.e2e-spec.ts` — the `jest.mock` line for the new query
- `backend/src/database/tests/integration/provider-bills.integration-spec.ts` — the real SQL test
