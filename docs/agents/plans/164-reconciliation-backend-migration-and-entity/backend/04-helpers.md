# Formula and eligibility helpers
These are pure functions, with no DB access, that the services of #165 and #166 call. Do every money computation in `bigint`, never `Number`.

**Formula helpers.** Create `backend/src/bank/reconciliation-balance.ts` (model.md § Formulas):
- `sumToBigInt(raw: string | null | undefined): bigint`: converts a SQL `SUM` string (or `NULL`) to `bigint`, with `NULL` as `0n`.
- `clearedBalance(openingBalance: bigint, clearedSum: bigint): bigint`: returns `openingBalance + clearedSum`.
- `reconciliationDifference(statementBalance: bigint, cleared: bigint, ticked: bigint): bigint`: returns `statementBalance - (cleared + ticked)`.
- `reconciliationStatus(reconciledAt: Date | null): 'open' | 'finished'`.
- **Debt sign:** the API takes and returns the signed value and the UI negates it. Document this in the module JSDoc. Add a helper only if it is useful, e.g. `isBalanced(difference)`. Do not negate on the server.

**Eligibility helpers.** Create `backend/src/bank/reconciliation-eligibility.ts` (model.md § Transaction change, § Statement lifecycle and § Lock matrix):
- `ineligibilityReason(row: { date: string; reconciliationId: number | null }, statement: { id: number; statementDate: string }, account: { openingDate: string }): 'after_statement' | 'before_opening' | 'cleared_elsewhere' | null`.
  - A row linked to a *different* statement is `cleared_elsewhere`. The caller only passes the account's open statement, so any other link is a finished statement.
  - A row already linked to this statement is eligible.
  - `isEligibleToTick(...)` wraps it as `ineligibilityReason(...) === null`.
- `shouldAutoUntick(newDate: string, openStatement: { statementDate: string }, account: { openingDate: string }): boolean`. It is true when `newDate > statementDate` or `newDate < openingDate`; exactly `statementDate` or exactly `openingDate` keeps the tick.
- Compare `YYYY-MM-DD` strings lexically. That is the convention already used with `ledger-date.ts`.

**Specs:**
- `bank/tests/reconciliation-balance.spec.ts`:
  - **Anchor and cleared rows:** the opening anchor alone, then the anchor plus a cleared sum.
  - **Debt account:** a negative opening and a negative statement balance give difference 0.
  - **Zero-row statement:** no rows, so difference = statement balance − opening.
  - **`NULL` SUM:** a `NULL` `SUM` becomes `0n`.
  - **Large values:** values near the 10¹³ bound keep full precision.
  - **Finish, undo, second statement:** the cleared balance after a finish, after an undo, and with a second statement, as sequences of sums.
- `bank/tests/reconciliation-eligibility.spec.ts`:
  - **The three causes:** each of `after_statement`, `before_opening` and `cleared_elsewhere`.
  - **Edge dates:** exactly `statementDate` and exactly `openingDate` are eligible.
  - **Already ticked:** a row already ticked on this statement is eligible.
  - **Auto-untick:** moved past `statementDate` unticks, before `openingDate` unticks, and exactly `statementDate` stays ticked.

The SQL side of "rows before the anchor excluded" is asserted in step 07.

## Files to Change
- `backend/src/bank/reconciliation-balance.ts` — new
- `backend/src/bank/reconciliation-eligibility.ts` — new
- `backend/src/bank/tests/reconciliation-balance.spec.ts` — new
- `backend/src/bank/tests/reconciliation-eligibility.spec.ts` — new
