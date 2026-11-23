# ReconciliationService and writers

Implement the lazy `ReconciliationService` as a thin facade over small collaborators, so that
each file stays under 300 lines and complexity 10. For example:

- `reconciliation.service.ts`: the facade, plus `list` and `get`;
- `reconciliation-lifecycle.writer.ts`: start, edit, cancel, finish and undo;
- `reconciliation-ticks.writer.ts`: ticks.

## Reads

Every method first resolves the account owner-scoped through `AccountService.findOwned(owner,
accountId)`, which gives the uniform 404. It then loads the statement by `{ id, accountId }`; a
miss gives the same 404, never a 409.

- `list(owner, accountId, page)` returns the history envelope `{ reconciliations, pagination }`
  using `buildPagination`.
  - `undoable` is true only on the latest finished statement, and only when no statement is open.
  - `transaction_count` comes from one grouped query.
- `get(owner, accountId, id)` returns the statement response.

## Writes

Each write runs inside `mapDeadlock(() => manager.transaction(...))`. Start and undo are also
wrapped in `mapOpenClash`.

**Lock order and check order.** Inside the transaction, every write:

1. re-reads the account `FOR UPDATE` (a missing row is the uniform 404);
2. reads the statement by `{ id, accountId }` `FOR UPDATE`;
3. for ticks only, locks the transaction rows in ascending id order.

It then applies the check order from the spec:

1. path 404;
2. the account-dependent 400s:
   - `parseAmountInput('statement_balance', value, account.currency)` with no `nonZero`, and the
     absolute value at most 10¹³ minor units;
   - `statement_date >= openingDate`, with a fixed message;
3. `ACCOUNT_ARCHIVED`;
4. the state 409s.

Every write returns the recomputed statement response, with both `SUM`s computed under the lock.

**Per write:**

- **start**:
  - Pre-check that no statement is open (`RECONCILIATION_OPEN`).
  - Check chronology: the date must be strictly after the latest finished statement
    (`RECONCILIATION_OUT_OF_ORDER`).
  - Insert the statement. A race on `ER_DUP_ENTRY` maps to `RECONCILIATION_OPEN`.
  - Returns 201.
- **edit**:
  - A finished statement is `RECONCILIATION_FINISHED`.
  - The chronology check runs only when `statement_date` changes, and compares against finished
    statements only. A balance-only edit skips it.
  - Moving the date earlier calls `untickAfter`.
- **cancel**:
  - A finished statement is `RECONCILIATION_FINISHED`.
  - Delete the statement. The FK `SET NULL` drops the ticks.
  - Returns 204.
- **ticks**:
  - Run `normalizeTicks` first.
  - Load all ids (tick and untick) with one account-scoped locked select. Any miss is a 404 that
    rejects the whole batch.
  - A finished statement is `RECONCILIATION_FINISHED`, checked before eligibility.
  - Check every tick id with `ineligibilityReason()`; any failure is `TRANSACTION_NOT_ELIGIBLE`
    and the whole batch rolls back.
  - Then run the bulk tick and untick.
- **finish**:
  - A finished statement is `RECONCILIATION_FINISHED`.
  - Recompute the difference under the lock; a non-zero difference is
    `RECONCILIATION_UNBALANCED`.
  - Set `reconciled_at` guarded by `reconciled_at IS NULL`, and check the affected rows.
- **undo**:
  - A statement that is not finished is `RECONCILIATION_NOT_FINISHED`.
  - An open statement on the account is `RECONCILIATION_OPEN`.
  - A statement that is not the latest finished one is `RECONCILIATION_NOT_LATEST`.
  - Set `reconciled_at = NULL`. The ticks are kept. A duplicate maps to `RECONCILIATION_OPEN`.

**Error messages.** Every 409 and 400 uses fixed text: no balance, date, id or count. Bodies are
never logged.

## Wiring and unit specs

Register the service and its writers in `BankModule` (providers and exports, plus a re-export).
In `bank-module.loader.ts`, add `reconciliations: ReconciliationService` to `BankServices` and the
`moduleRef.get` line, and update `bank-module.loader.spec.ts` to match.

Unit specs, using the in-memory repos and queries, cover:

- each write's happy path and every 409 in check order;
- difference and `BigInt` handling;
- de-duplication, and an untick of a cleared or unlinked row being a no-op;
- the whole-batch rollback on 404 or ineligibility;
- the `pessimistic_write` lock order recorded in `repo.locks`;
- the `ER_DUP_ENTRY` and deadlock mappings.

## Files to Change
- `backend/src/bank/reconciliation.service.ts` (new) — the facade with list and get.
- `backend/src/bank/reconciliation-lifecycle.writer.ts` (new) — start, edit, cancel, finish and
  undo, under lock.
- `backend/src/bank/reconciliation-ticks.writer.ts` (new) — the bulk tick and untick under lock.
- `backend/src/bank/bank.module.ts` — providers, exports and re-export.
- `backend/src/bank/bank-module.loader.ts` — the `BankServices.reconciliations` field and its
  `moduleRef.get` line.
- `backend/src/bank/tests/bank-module.loader.spec.ts` — the new service.
- `backend/src/bank/tests/reconciliation.service.spec.ts` (new) — unit specs.
- `backend/src/bank/tests/reconciliation-writers.spec.ts` (new) — unit specs for the writers.
