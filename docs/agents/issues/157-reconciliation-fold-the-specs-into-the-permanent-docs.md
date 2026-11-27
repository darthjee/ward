# Issue: Reconciliation — fold the specs into the permanent docs

## Description
Phase 4 of epic [#85](https://github.com/darthjee/ward/issues/85) (Reconciliation), and the feature's last sub-issue. Every implementation issue (#164, #165, #166, #167, #168) has merged, so `docs/agents/specs/reconciliation/` must now be folded into the permanent docs and removed, following the [Feature Specs lifecycle](https://github.com/darthjee/ward/blob/main/docs/agents/specs.md#lifecycle).

## Problem
Specs are temporary. The permanent docs do not yet describe reconciliation: `modules/bank/transactions.md` still says rows are "editable and hard-deletable — nothing is locked until reconciliation exists", `backend/routes/bank.md` has no reconciliation routes or lock errors, and only `modules/bank/ui.md` got a partial update during the implementation.

## Expected Behavior
- **Permanent docs updated** with the lasting content of the spec (model, API, locks, security decisions, UI), described as shipped behavior:
  - `docs/agents/modules/bank/transactions.md` — cleared rows, the lock, and removal of the "editable and hard-deletable" statement.
  - `docs/agents/modules/bank/accounts.md` — statements / checkpoints per account and the account-level locks.
  - `docs/agents/modules/bank/bills.md` — how bill payments interact with cleared rows.
  - `docs/agents/modules/bank/ui.md` — reconcile mode, statements history, ledger markers (completing the partial update).
  - `docs/agents/backend/routes/bank.md` — the reconciliation routes and the lock errors on existing routes (under both `/bank` and `/orgs/<id>/bank`).
  - Any other permanent doc that mentions cleared rows, locks or statements (e.g. `modules/bank.md`, `product.md`, `architecture/frontend.md`).
- **Future epics opened** before the spec is removed: one GitHub epic per entry in the spec's `## Future epics` section (Statement import, Statement-to-ledger drill-down, Statement audit log), each seeded with the detail recorded there. The Statement audit log epic links [#95](https://github.com/darthjee/ward/issues/95), the audit trail it overlaps. Their URLs are recorded where the permanent docs mention the deferred concern.
- **Spec removed**: `docs/agents/specs/reconciliation/` is deleted; its row moves from *Active specs* to *Completed specs* in `docs/agents/specs.md` (pointing at the permanent docs that now hold it, with the follow-up epics column filled), and *Active specs* reads "none".
- **Epic #85 closed**: the PR for this issue also closes [#85](https://github.com/darthjee/ward/issues/85), since this is its last sub-issue.
- No link to `specs/reconciliation/` remains anywhere in the repo outside `issues/` and `plans/`.

## Solution
Architect-owned documentation change, following the precedents of #58/#59, #126 and #145. No code changes.

## Benefits
- The permanent docs match the shipped behavior, and no stale spec is left behind.
- Deferred concerns survive as tracked epics instead of being lost with the spec.
