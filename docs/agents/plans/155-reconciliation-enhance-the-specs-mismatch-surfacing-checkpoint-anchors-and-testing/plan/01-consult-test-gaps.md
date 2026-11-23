# Consult backend and frontend on the test gaps

Before editing anything, send the two specialists a read-only gap review, in parallel (the
reviews are independent). Neither agent edits files: each returns a list of missing test cases,
with the target spec file and the rule each one covers.

**`backend` agent.** Give it `model.md` (§ Statement lifecycle, § Lock matrix, § Formulas,
§ Required tests), `api/reconciliations.md`, `api/existing-routes.md` and `security.md`. Ask it
to:

- check every lifecycle step (start, edit while open, tick/untick, finish, undo, cancel) and
  each of its listed 409/400 errors against the Required tests of `model.md`,
  `api/reconciliations.md` and `security.md`;
- check every lock-matrix cell (uncleared / open-ticked / cleared × PATCH amount/date, PATCH
  description/notes, DELETE, bill-payment undo or delete) and the `ACCOUNT_RECONCILED` /
  `CURRENCY_LOCKED` anchor locks (open statement, after finish, after undo, after cancel) against
  `api/existing-routes.md` § Required tests;
- confirm the naming and location convention for the new lifecycle e2e spec under
  `backend/src/bank/tests/`, and how the existing e2e specs run one scenario under both the
  personal (`/bank`) and the org (`/orgs/<id>/bank`) base paths (e.g. `org-roles.e2e-spec.ts`);
- confirm that the new spec does not need any change to `accountant.e2e-spec.ts` or the
  bill-payment specs.

Candidate gaps to have it confirm or reject (taken from a first read of the spec):

- undo keeps the ticks (the rows go back to open-ticked and unlock), and cancel drops them (the
  rows become uncleared again);
- an edit that moves a ticked row's date **past `statementDate`** unticks it (only the "before
  `opening_date`" case is listed today);
- DELETE of an open-ticked row drops the tick and recomputes the difference;
- bill-payment **delete** (not just undo) of a cleared generated row answers `TRANSACTION_CLEARED`;
- the anchor and currency locks are released again after cancelling the only (open) statement,
  or after undoing and then cancelling;
- the account archive path while a statement exists (`ACCOUNT_ARCHIVED` on every
  reconciliation write);
- zero-row statement: start, finish at difference 0, undo;
- the cleared-balance formula after finish, undo and a second statement (chronology).

**`frontend` agent.** Give it `ui/reconcile.md`, `ui/ledger.md` and `api/reconciliations.md`
§ Error codes. Ask it to check the Jasmine Required tests against the UI flows for every
lifecycle step: the start and edit statement form (date bounds, balance input), the tick and
untick toggles, finish success (leaving reconcile mode, the header line refreshed), cancel
(confirmation, role gating), and history undo (refresh, rows unlocked). Also ask it to confirm
that every new error code has a mapped message test. It must keep the frontend on Jasmine only,
with no e2e tooling added.

Collect both reports and use them as the input for step 03.

## Files to Change

- None. This step is read-only.
