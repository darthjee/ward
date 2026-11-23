# Test support (fake data source, in-memory repos and queries)
Extend the e2e test support so #165 and #166 can drive the reconciliation flows in memory. This must land together with step 02.

## In-memory repository
Create `backend/src/bank/tests/support/in-memory-reconciliation-repos.ts` (`in-memory-bank-repos.ts` is already at the 300-line `max-lines` limit):
- Build the repo with `createInMemoryBankRepo(Reconciliation, checkOpenKey)`, where `checkOpenKey(candidate, others)` throws `mysqlError('ER_DUP_ENTRY')` when another row has the same `accountId` and both have `reconciledAt === null`. That is the unique-open rule, the same shape as `checkActiveName`. `pessimistic_write` is recorded for free by `findOne({ where, lock })` into `repo.locks`.
- Export the delete-wiring helpers that `in-memory-bank-repos.ts` calls, to keep that file under the limit (extract existing helpers if needed):
  - **SET NULL on cancel:** `reconciliations.delete(where)` sets `reconciliationId = null` on the matching `transactions` rows.
  - **Cascade:** `accounts.delete` also removes the account's reconciliations. It keeps the existing `ER_ROW_IS_REFERENCED_2` guard when transactions exist.
- `transactions.create` defaults `reconciliationId: null`, like the existing `sentToAccountantAt` default.

## Wiring
- `InMemoryBankRepos` gains `reconciliations`, built in `createInMemoryBankRepos()`.
- `fakeDataSource` in `bank/tests/support/build-bank-test-app.ts` gains `if (entity === Reconciliation) return { ...repos.reconciliations, manager };`.

## In-memory queries
In `bank/tests/support/in-memory-ledger.query.ts`, mirror step 05:
- `AccountBalancesQuery.clearedBalance` / `tickedSum` compute from the in-memory transactions and reconciliations: the anchor filter, finished-only and same-account scope.
- `LedgerQuery` rows carry `reconciliation`, and `lastReconciledDate` is added.
- Inject the `Reconciliation` repo where needed.

## Specs
Add `bank/tests/support/in-memory-reconciliation-repos.spec.ts`, or cases in an existing support spec if one exists, covering:
- the unique-open clash and its release after `reconciledAt` is set;
- SET NULL on delete;
- the account cascade;
- the `pessimistic_write` lock recording;
- the new in-memory query methods.

Leave `KNOWN_CONTROLLERS` unchanged. Every existing e2e spec must pass unmodified.

## Files to Change
- `backend/src/bank/tests/support/in-memory-reconciliation-repos.ts` — new
- `backend/src/bank/tests/support/in-memory-bank-repos.ts` — `reconciliations` field, wiring, `reconciliationId` default (stay ≤ 300 lines)
- `backend/src/bank/tests/support/build-bank-test-app.ts` — `fakeDataSource` branch
- `backend/src/bank/tests/support/in-memory-ledger.query.ts` — in-memory mirrors of the new query methods
- `backend/src/bank/tests/support/in-memory-reconciliation-repos.spec.ts` — new spec
