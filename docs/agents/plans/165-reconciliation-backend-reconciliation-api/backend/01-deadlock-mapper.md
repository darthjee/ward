# Deadlock 409 mapper

This issue owns the deadlock mapping, and #166 reuses it. An unexpected `ER_LOCK_DEADLOCK` must
become a uniform 409 with fixed text, never a 500.

- In `mysql-errors.ts`, add `MYSQL_LOCK_DEADLOCK = 'ER_LOCK_DEADLOCK'`.
- In `core/error-codes.ts`, add a new code, for example `CONCURRENT_UPDATE`. Use a fixed,
  retry-style text such as "The request conflicted with another change; please retry". The text
  never contains detail.
- In `reconciliation-conflicts.ts`, add:
  - a factory, `concurrentUpdate()`, which returns a `ConflictException` with that code;
  - a shared mapper, `mapDeadlock<T>(write: () => Promise<T>): Promise<T>`. It catches
    `isMysqlError(error, MYSQL_LOCK_DEADLOCK)` and rethrows `concurrentUpdate()`. Any other error
    passes through unchanged.

  The mapper composes with the existing `mapOpenClash`. Every reconciliation write (step 04)
  wraps its whole `manager.transaction` call in `mapDeadlock`. The writes that can hit
  `open_key` (start and undo) also go through `mapOpenClash`. #166 imports the same `mapDeadlock`
  for the existing locked routes.

Add a unit spec covering three cases:

- a MySQL-shaped `ER_LOCK_DEADLOCK` error (`{ code: 'ER_LOCK_DEADLOCK' }`, the same shape the
  `ER_DUP_ENTRY` tests use) becomes the 409 with its code and fixed text;
- other errors, including `ER_DUP_ENTRY`, pass through;
- a resolved value is returned.

Also extend `reconciliation-conflicts.spec.ts` for the new factory.

## Files to Change
- `backend/src/bank/mysql-errors.ts` — add `MYSQL_LOCK_DEADLOCK`.
- `backend/src/core/error-codes.ts` — add the deadlock code.
- `backend/src/bank/reconciliation-conflicts.ts` — add `concurrentUpdate()` and `mapDeadlock()`.
- `backend/src/bank/tests/reconciliation-conflicts.spec.ts` — add the factory and mapper unit specs.
