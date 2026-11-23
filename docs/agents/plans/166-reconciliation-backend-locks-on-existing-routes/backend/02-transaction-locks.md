# Transaction PATCH/DELETE locks

Enforce the lock matrix of `model.md` on the transaction routes, under the common lock order.

**PATCH (`update()`)**:

1. Before any lock: validate and parse the body (`parseAmountInput`, which gives the 400), so
   the check order becomes 404 (account), 400, `ACCOUNT_ARCHIVED`, the payment-generated 403,
   then `TRANSACTION_CLEARED`.
   - The 404 for a missing account must still win over the 400. Resolve the account with
     `findOwned` (404) before parsing, then re-read it under the lock.
   - Also keep the 404 for a missing transaction ahead of the 400.
2. In `mapDeadlock(() => manager.transaction(async (manager) => ...))`:
   - `lockAccount(manager, owner, accountId)`: re-check `carriesLedger` (404) and archived (409
     `ACCOUNT_ARCHIVED`).
   - Read the open statement (`ReconciliationQuery.openStatement(accountId, manager)`). Lock it
     with `lockStatement` when the row is ticked.
   - Lock the row with `ReconciliationQuery.lockTransactions(manager, accountId, [id])`. A missing
     row answers the uniform 404.
   - Payment-generated check and `#assertMayEdit` (403).
   - If the row is cleared (linked to a finished statement), and the parsed `amount` (BigInt
     minor units) or `date` differs from the stored value, answer `transactionCleared()`.
     Compare values, not strings: `"10"` and `"10.00"` are equal. `description` and `notes`
     always pass. A rejected request applies nothing.
   - If the row is ticked and `shouldAutoUntick(newDate, openStatement, account)`, clear
     `reconciliationId` on the row (or call `ReconciliationQuery.untick`).
   - Save through the transactional manager.
3. The response carries `reconciliation` from an account-scoped lookup
   (`r.id = t.reconciliation_id AND r.account_id = t.account_id`). Extend `serializeTransaction`
   with a `reconciliation` argument. POST always returns `null`: a new row is uncleared, even when
   it is dated inside a finished period.

**DELETE (`delete()`)**: in the same transactional wrapper and lock order: account lock (404,
archived), row lock (404), then `transactionCleared()` if cleared. A ticked row is deleted, and
its tick goes with it. There is no payment-generated 403 on DELETE today, so a cleared
payment-generated row answers `TRANSACTION_CLEARED` on a direct DELETE. No role bypasses the lock,
`admin` included.

If the service grows past the file-size limit, move the locked update/delete body into a new
`transaction.writer.ts` provider and register it in `bank.module.ts`.

Tests (`transactions.e2e-spec.ts` plus units), one `it.each` row per lock-matrix cell. Rows are
the three states (uncleared, open-ticked, cleared). Columns are PATCH `amount` / `date`, PATCH
`description` / `notes`, and DELETE. Also cover:

- an unchanged `amount` / `date` on a cleared row is accepted (`"10"` vs `"10.00"`);
- a changed `amount` together with a `description` change is 409, with nothing applied;
- DELETE of a cleared row is 409 as `admin` and as `owner`;
- DELETE of an open-ticked row is 204 and changes the statement's `ticked_sum`, `difference` and
  `transaction_count`;
- auto-untick past `statementDate` and before `opening_date`, with `difference` recomputed;
  a row moved to exactly `statementDate` stays ticked;
- the check order (ARCHIVED, then 403, then CLEARED). A cleared payment-generated row answers 403
  on PATCH and `TRANSACTION_CLEARED` on DELETE;
- a POST dated inside a finished period is allowed and uncleared, and the POST/PATCH
  `reconciliation` comes from the account-scoped lookup;
- `reconciliation_id` and `reconciliation` in a POST/PATCH body answer 400;
- a tick or finish interleaved through `beforeNextTransaction` ends as listed under `security.md`
  § Concurrency;
- units: `pessimistic_write` is recorded on the account and the row (`repo.locks` /
  `lockCalls`), and an `ER_LOCK_DEADLOCK` maps to `CONCURRENT_UPDATE`.

## Files to Change
- `backend/src/bank/transaction.service.ts` — reordered checks, transactional locked update/delete, `reconciliation` in responses
- `backend/src/bank/transaction.writer.ts` (new, optional) — the locked write body if the service gets too long
- `backend/src/bank/transaction-response.ts` — `reconciliation` on `TransactionResponse`
- `backend/src/bank/bank.module.ts` — inject `ReconciliationQuery` (and the writer, if created)
- `backend/src/bank/tests/transaction.service.spec.ts` — unit cases
- `backend/src/bank/tests/transaction-response.spec.ts` — `reconciliation` field
- `backend/src/bank/tests/transactions.e2e-spec.ts` — lock matrix and the cases above, plus the `reconciliation.query` in-memory mock
