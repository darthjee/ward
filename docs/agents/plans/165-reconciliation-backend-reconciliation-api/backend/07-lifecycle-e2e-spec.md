# Lifecycle e2e spec

Add `backend/src/bank/tests/reconciliation-lifecycle.e2e-spec.ts`. It runs one end-to-end
scenario under both base paths, using `describe.each(CONTEXTS)` from `bill-payments.e2e-spec.ts`.
It must not duplicate the per-route coverage from step 06.

**Scenario:**

1. Start a statement.
2. Tick and untick rows, checking the live `ticked_sum`, `cleared_balance` and `difference` on
   each response.
3. Finish at difference 0.
4. **Locks (depends on #166).** PATCH `amount` / `date` on a cleared row is 409
   `TRANSACTION_CLEARED`. DELETE is 409. A description edit is allowed. The anchor and currency
   PATCHes on the account are 409 (`ACCOUNT_RECONCILED` / `CURRENCY_LOCKED`).
5. Undo:
   - the rows unlock;
   - the ticks are kept on the reopened statement;
   - `ticked_sum`, `cleared_balance` and `difference` are restored.
6. Cancel:
   - the ticks are dropped and the rows are uncleared;
   - **(depends on #166)** the anchor and currency locks are released when no statement remains,
     and are still held after an undo until the later cancel.
7. A zero-row statement: start, finish at 0, undo, cancel.
8. A second statement whose cleared balance counts the rows of the first (chronology), and its
   undo.
9. `x-cache-invalidate` is present on every 2xx write and absent on a 409.

**Optional:** the accountant `mark-sent` and `mark-unsent` work on a ticked row and on a cleared
row, and leave `reconciliation` untouched.

**#166 sequencing.** If #166 has not merged when this step runs, implement steps 1–3, 5, the
tick part of 6, and 7–9 now. Mark the step-4 and step-6 lock assertions as `it.todo(...)`, with a
comment that #166 (or whichever of #165 and #166 merges second) turns them on. If #166 has
merged, implement them fully and make them green.

## Files to Change
- `backend/src/bank/tests/reconciliation-lifecycle.e2e-spec.ts` (new) — the end-to-end lifecycle
  under both base paths.
