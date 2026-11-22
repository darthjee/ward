# Record the security review of routes and 409 paths

Apply the `security` findings to the API and security specs. At a minimum, settle these points:

- **Check order** (`api/reconciliations.md` § Check order): rewrite it as path 404 → role 403
  → body 400 → `ACCOUNT_ARCHIVED` → state 409, which matches `OwnerContextGuard` and
  `backend/routes/bank.md` ("404 before 403").
- **Bulk-tick validation**:
  - at most 50 ids per array;
  - `tick` and `untick` disjoint;
  - at least one array non-empty;
  - every id valid under `parseId`;
  - a rule for duplicates inside one array (reject with 400 or de-duplicate; pick one);
  - non-array or non-integer values answer 400 through `@StrictBody()`.

  State this once in `security.md` § Decided → Input bounds and reference it from the ticks row.
- **Statement date bounds**: pick one rule and use it in every file. On or after the account's
  `opening_date`, strictly after the latest finished `statement_date`, and at most either
  "today (UTC)" or "UTC today + 1 day" (the timezone slack the ledger already uses, if any).
  Align these three places:
  - `security.md` § Decided → Input bounds;
  - the POST and PATCH rows in `api/reconciliations.md`;
  - `ui/reconcile.md` § Start and edit statement form (`max`).
- **Statement balance bounds**:
  - state that the 10¹³ minor-unit bound applies to the absolute value;
  - say whether negative balances are allowed (they are needed for debts and overdrafts);
  - require the decimal-string format of `backend/routes/bank.md`, with currency precision.
- **Concurrency** (`api/reconciliations.md` § Concurrency): add the race outcomes.
  - Two concurrent starts: the unique `open_key` violation maps to 409 `RECONCILIATION_OPEN`,
    never 500.
  - Tick vs. transaction PATCH or DELETE: the tick locks the statement row and re-checks
    eligibility inside the transaction.
  - Finish vs. tick: finish re-computes the difference under the lock.
  - Undo vs. start: both lock, and the loser gets the matching 409.
- **409 paths**:
  - Confirm that no 409 body leaks data outside scope. The codes carry no ids from other
    accounts.
  - Confirm that every 409 is evaluated after the 404 and 403 checks, so a non-member never
    learns a statement's state.
- **Sensitivity**: keep "bodies are never logged". Add any finding about error messages that
  echo the statement balance.
- Record the outcome in a short "Security review (#153)" note in `security.md` § Decided, or
  as new rows there.
- Required tests in `security.md` and `api/reconciliations.md`:
  - each new bound (the duplicate-id rule, a negative balance within bounds, a balance above
    the absolute bound, the date bound at today and the day after);
  - the 403-before-400 order (a `user` sending an invalid body to cancel gets 403);
  - the concurrent-start 409.

## Files to Change

- `docs/agents/specs/reconciliation/api/reconciliations.md` — check order with 403, bounds on the POST, PATCH and ticks rows, race outcomes in § Concurrency, extra Required tests
- `docs/agents/specs/reconciliation/security.md` — Input bounds row finalized, security review outcome, extra Required tests
- `docs/agents/specs/reconciliation/ui/reconcile.md` — statement date `max` aligned with the chosen bound
