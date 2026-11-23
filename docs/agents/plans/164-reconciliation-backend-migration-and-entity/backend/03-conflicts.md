# Error codes and conflict factories
**Error codes.** Add these keys to `ErrorCodes` in `backend/src/core/error-codes.ts`:
`RECONCILIATION_OPEN`, `RECONCILIATION_FINISHED`, `RECONCILIATION_NOT_FINISHED`,
`RECONCILIATION_NOT_LATEST`, `RECONCILIATION_OUT_OF_ORDER`, `RECONCILIATION_UNBALANCED`,
`TRANSACTION_NOT_ELIGIBLE`, `TRANSACTION_CLEARED` and `ACCOUNT_RECONCILED`. `ACCOUNT_ARCHIVED` and `CURRENCY_LOCKED` already exist; reuse them.

**Factories.** Create `backend/src/bank/reconciliation-conflicts.ts`, following `account-conflicts.ts`: one exported function per new code, each returning `new ConflictException({ code, message })`, with JSDoc. The messages are fixed static text. They must never carry a balance, difference, date, id or count (security.md § Data sensitivity). Use these texts:

| Factory | Code | Message |
|---|---|---|
| `reconciliationOpen()` | `RECONCILIATION_OPEN` | `This account already has an open reconciliation.` |
| `reconciliationFinished()` | `RECONCILIATION_FINISHED` | `This reconciliation is already finished.` |
| `reconciliationNotFinished()` | `RECONCILIATION_NOT_FINISHED` | `This reconciliation is not finished.` |
| `reconciliationNotLatest()` | `RECONCILIATION_NOT_LATEST` | `Only the latest finished reconciliation can be undone.` |
| `reconciliationOutOfOrder()` | `RECONCILIATION_OUT_OF_ORDER` | `The statement date must be after the latest finished reconciliation.` |
| `reconciliationUnbalanced()` | `RECONCILIATION_UNBALANCED` | `The reconciliation is not balanced.` |
| `transactionNotEligible()` | `TRANSACTION_NOT_ELIGIBLE` | `A selected transaction cannot be part of this reconciliation.` |
| `transactionCleared()` | `TRANSACTION_CLEARED` | `This transaction is part of a finished reconciliation.` |
| `accountReconciled()` | `ACCOUNT_RECONCILED` | `The opening date and balance cannot change once the account has a reconciliation.` |

**`mapOpenClash`.** Also add `mapOpenClash<T>(write: () => Promise<T>): Promise<T>`, mirroring `mapNameClash` in `account-conflicts.ts`. It maps `isMysqlError(error, MYSQL_DUPLICATE_ENTRY)` to `reconciliationOpen()` and rethrows anything else. #165 uses it around start and undo.

**Spec.** Add `backend/src/bank/tests/reconciliation-conflicts.spec.ts`:
- with `it.each` (the pattern of `bank-small-helpers.spec.ts`), each factory is a `ConflictException` whose `getResponse()` is `{ code: ErrorCodes.X, message: <exact text> }`;
- `mapOpenClash` maps a duplicate-entry error to 409 `RECONCILIATION_OPEN`, passes a successful result through, and rethrows other errors.

## Files to Change
- `backend/src/core/error-codes.ts` — new codes
- `backend/src/bank/reconciliation-conflicts.ts` — new factories and `mapOpenClash`
- `backend/src/bank/tests/reconciliation-conflicts.spec.ts` — new spec
