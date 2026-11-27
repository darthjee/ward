# Backend Plan: Reconciliation — fold the specs into the permanent docs

Main plan: [plan.md](plan.md)

## Shared contracts

The backend **relies on** the architect having created these headings (exact names, see
[plan.md](plan.md#shared-contracts) for the per-file mapping):

- `docs/agents/modules/bank/reconciliation.md`: *Reconciliation entity*, *Formulas*,
  *Statement lifecycle*, *Lock matrix*, *Migration*, *Concurrency*, *Memory*,
  *Data sensitivity and ownership*.
- `docs/agents/backend/routes/bank.md`: *Reconciliation check order*,
  *Reconciliation locks on existing routes*.

Open the two files and confirm the headings exist before editing. If the architect renamed one,
follow `plan.md`'s updated table.

## Implementation Steps

### Step 1 — Repoint the spec citations in comments
Every comment that cites `docs/agents/specs/reconciliation/...` points at a folder this issue
deletes. Rewrite each citation to the permanent page and section from the mapping in
`plan.md`. Keep the existing comment style (``see `docs/agents/<path>.md`, *Section*``) and keep
the edit to the path and section name: no behavior or logic change, no other comment rewording.
This is the same kind of change as #105 (PR #112) made after the bank/auth fold. Files (from
`grep -rn "specs/reconciliation" backend/src`):

- `backend/src/database/migrations/20261123120027-bank-create-reconciliations.ts`
- `backend/src/bank/entities/reconciliation.entity.ts`
- `backend/src/bank/reconciliation-balance.ts`
- `backend/src/bank/reconciliation-eligibility.ts`
- `backend/src/bank/reconciliation.query.ts`
- `backend/src/bank/reconciliation-conflicts.ts`
- `backend/src/bank/reconciliation-guards.ts`
- `backend/src/bank/account-reconciliation-guard.ts`
- `backend/src/bank/bill-payment-undo-locks.ts`
- `backend/src/bank/transaction.writer.ts`
- `backend/src/bank/tests/transaction-locks.e2e-spec.ts`
- `backend/src/bank/tests/support/in-memory-reconciliation-repos.ts`

Edit only the comment in the migration file. Its code and its timestamp must not change.

### Step 2 — Verify
`grep -rn "specs/reconciliation" backend --exclude-dir=node_modules` returns nothing. Run lint
and the unit tests through Docker to confirm that a comment edit broke nothing (for example a
reflowed JSDoc that exceeds max-len).

## Files to Change
- The 12 files listed in Step 1: comment-only path / section repoint

## CI Checks
- `backend`: `docker-compose run --rm ward_tests yarn lint` and `docker-compose run --rm ward_tests yarn test`
  (CircleCI backend lint / test jobs).

## Notes
- Runs after the architect's steps, because the target anchors must exist first.
- Never run `yarn` on the host. Use `docker-compose run` only.
