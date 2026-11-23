# Per-route e2e spec, role matrix and lazy loading

## `reconciliations.e2e-spec.ts`

Add `reconciliations.e2e-spec.ts`, built with `buildBankTestApp()`. It uses
`describe.each(CONTEXTS)` over `/bank` and `/orgs/<id>/bank`, and `jest.mock`s the ledger,
balances and reconciliation queries to their in-memory twins, as `bill-payments.e2e-spec.ts`
does. It owns the per-route, per-error-code and check-order coverage from
`api/reconciliations.md` § Required tests and `security.md` § Required tests.

**Start:**

- A date equal to `opening_date` is accepted.
- A date equal to the latest finished date is 409 `RECONCILIATION_OUT_OF_ORDER`.
- A date that breaks both rules is 400.
- A second start is 409 `RECONCILIATION_OPEN`.
- Today + 1 day is accepted; the day after is 400 (also on PATCH).
- A negative balance, zero, and an absolute value of 10¹³ are accepted. 10¹³ + 1 of either sign,
  and wrong decimals, are 400.

**Edit:**

- Editing a finished statement is 409 `RECONCILIATION_FINISHED`.
- The chronology is checked against finished statements only.
- A balance-only edit does not check the chronology.

**Ticks:**

- Each of the three `TRANSACTION_NOT_ELIGIBLE` causes is covered.
- `RECONCILIATION_FINISHED` takes priority over `TRANSACTION_NOT_ELIGIBLE`.
- An ineligible or foreign id rolls back the whole batch.
- These bodies are 400: 51 ids, overlapping arrays, empty arrays, extra fields, and the
  mass-assignment fields.
- Duplicate ids are de-duplicated.
- An untick of a cleared or unlinked row is a no-op.

**Finish, cancel and undo:**

- Finish: `RECONCILIATION_UNBALANCED`, and a second finish is `RECONCILIATION_FINISHED`.
- Cancel of a finished statement is 409.
- Undo: `RECONCILIATION_NOT_LATEST`, `RECONCILIATION_OPEN` and `RECONCILIATION_NOT_FINISHED`.

**History and lookup:**

- History order, with the open statement first.
- `undoable` and `transaction_count`.
- 50 per page, and a malformed `page` is 400.
- A sibling account's statement is 404 on GET, PATCH, DELETE, ticks, finish and undo.

**Archive:**

- With an open statement, every write answers `ACCOUNT_ARCHIVED` before the state 409s.
- GETs still work while archived.
- The writes work again after unarchive.

**Access:**

- A non-member, a foreign account and global `is_admin` all get the uniform 404.
- The personal context counts as `owner`: undo and cancel succeed there.

**Roles** (org base path only):

- A `user` gets 403 on cancel and undo, even with an invalid body (403 before 400).
- `admin` and `owner` pass.

**Concurrency:**

- A concurrent start gives 201 + 409 `RECONCILIATION_OPEN`. Drive it with `beforeNextTransaction`
  and an in-memory repo throwing a MySQL-shaped `ER_DUP_ENTRY`.
- Undo vs. start is handled the same way.
- A deadlock injected the same way gives the uniform 409, never a 500.

**Responses:**

- Every GET has `x-cache-allow`.
- Every write has `X-Skip-Cache`.
- A 2xx write carries `x-cache-invalidate` equal to `base(orgId)`. A 409 carries none.
- No 400 or 409 body contains a balance, date, id or count.

Keep the file under 300 lines. Split it by concern if needed, for example:

- `reconciliations.e2e-spec.ts`;
- `reconciliation-ticks.e2e-spec.ts`;
- `reconciliation-bounds.e2e-spec.ts`.

## Other specs

- **`org-roles.e2e-spec.ts`:** add the six reconciliation writes to `ROUTES`. Start, edit, ticks
  and finish are `user`; cancel and undo are `admin`. Each `setup` creates an account and, where
  needed, an open or finished statement. Bump `toHaveLength(22)` to `28`.
- **`bank-lazy-loading.e2e-spec.ts`:**
  - a reconciliation GET loads `BankModule` exactly once;
  - a `user` 403 on undo does not load it;
  - a ticks body with 51 ids (DTO 400) does not load it.
- **Unchanged specs:** `accountant.e2e-spec.ts` and the bill-payment specs must stay green and
  must not be edited.

## Files to Change
- `backend/src/bank/tests/reconciliations.e2e-spec.ts` (new) — the per-route, error-code,
  check-order, bounds, roles, concurrency and cache coverage. Split it by concern if needed.
- `backend/src/bank/tests/support/in-memory-reconciliation-repos.ts` — extend it for deadlock
  injection, if the existing hook cannot already throw arbitrary MySQL codes.
- `backend/src/bank/tests/org-roles.e2e-spec.ts` — add the six routes and set the count to 28.
- `backend/src/bank/tests/bank-lazy-loading.e2e-spec.ts` — the reconciliation lazy-load cases.
