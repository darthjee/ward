# Issue: Reconciliation — enhance the specs: mismatch surfacing, checkpoint anchors and testing

## Description

Phase 2 of epic #85 (Reconciliation). This is the last spec-enhancement issue. It refines `docs/agents/specs/reconciliation/` on three topics: how mismatches surface, the checkpoint-anchors alternative, and the testing strategy. It then closes the remaining open concerns in `security.md`, so the specs are ready for phase 3 (creating the implementation issues).

## Problem

- Mismatches surface only through the difference bar and the warning badge on uncleared rows in a reconciled period. The spec marks "no more surfacing" as a provisional default only.
- "Checkpoint anchors" (each finished statement becomes a new balance anchor) is listed as an alternative to settle. The provisional recommendation is to reject it.
- Each spec file has its own Required tests section, but nobody has checked those lists against the lifecycle and lock rules, and no spec names an end-to-end lifecycle test.

## Expected Behavior

The spec states the following decisions, and both open concerns move from **Open concerns** to **Decided** in `security.md`. The README's Delivery and Open concerns sections are updated to match.

- **Mismatch surfacing — none beyond the difference bar and the warning badge.** No account-list indicator and no notifications in this epic. Account detail fields stay off the list payload, as `security.md` already decided.
- **Checkpoint anchors — rejected.** Balances stay computed as the opening anchor plus every cleared row. The spec records the reasoning: no second source of truth for balances, undo stays a plain revert of the latest statement, and the cleared-row locks already protect the history that a checkpoint would freeze.
- **Testing strategy:**
  - A gap review of every file's Required tests against the lifecycle rules (start, edit, tick, finish, undo, cancel) and the lock rules (`TRANSACTION_CLEARED`, `ACCOUNT_RECONCILED`, the opening-anchor and currency locks). Missing cases are added to the relevant file.
  - A dedicated backend e2e spec, named in `api/reconciliations.md`, that covers the full lifecycle under both the personal (`/bank`) and the organization (`/orgs/<id>/bank`) base paths: start, tick and untick, finish at difference 0, the locks on the cleared rows, undo, and cancel.
  - The frontend stays with Jasmine specs for reconcile mode and the ledger markers, as listed in `ui/reconcile.md` and `ui/ledger.md`.
  - The README's testing overview names the new e2e spec. The existing `accountant.e2e-spec.ts` and the bill-payment specs must stay green and unchanged.

## Solution

The architect updates the spec after consulting the `backend` and `frontend` agents on the test gaps. This is documentation only: no code changes.

## Benefits

- The last design questions are closed before implementation starts.
- Phase 3 can split the work with a complete, gap-checked test list for each sub-issue.
