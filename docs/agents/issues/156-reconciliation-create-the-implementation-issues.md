# Issue: Reconciliation — create the implementation issues

## Description

Phase 3 of epic #85 (Reconciliation). The reconciliation specs in `docs/agents/specs/reconciliation/` are finished: #152, #153, #154 and #155 are all closed, and the README says no open concerns remain. This issue breaks those specs into implementation sub-issues of #85. The fold phase already has its own issue (#157), so it is not created here.

## Problem

The specs describe the whole feature, but the auto-resolve pipeline needs small, standalone issues that one specialist can each work on.

## Expected Behavior

- Five implementation sub-issues are created and linked to #85 as GitHub sub-issues. This follows the split the specs suggest in `README.md` § Sub-issue → file map:
  1. **backend: migration plus entity.** The `reconciliations` table, the `reconciliation_id` FK on `bank_transactions`, and the entity and `Transaction` change. Reads `model.md` and `security.md`.
  2. **backend: reconciliation API.** The new routes, payloads, error codes, cache classes and invalidation, plus the `reconciliation-lifecycle.e2e-spec.ts` lifecycle spec under both base paths. Reads `model.md`, `api/reconciliations.md` and `security.md`.
  3. **backend: locks on existing routes.** The transaction, ledger, account and bill-payment route changes and the opening-anchor lock. Reads `model.md` and `api/existing-routes.md`.
  4. **frontend: reconcile mode plus Statements history.** Reads `api/*.md`, `ui/reconcile.md` and `ui/ledger.md`.
  5. **frontend: ledger markers.** The cleared marker, locked fields, warning badge and header line. Reads `api/existing-routes.md` and `ui/ledger.md`.
- No cache/Navi issue is created. The specs state that Navi warms nothing and `navi/navi_config.yaml` needs no change.
- Each issue stands alone. It names the spec files and the Required tests sections it must satisfy, and states its dependencies.
- The order is recorded: 1 → 2 and 3 (both depend only on 1) → 4 (needs 2) and 5 (needs 3). All backend issues come before the frontend ones.
- The `Sub-issue → file map` table in `docs/agents/specs/reconciliation/README.md` is updated, with the TBD rows replaced by the new issue numbers and the confirmed file lists.

## Solution

Create the five issues from the specs, either with `/arcanum-split-issue 85` (continuing the existing split) or directly, and link each one to #85 as a sub-issue. Then update the README's sub-issue map in the same change that closes this issue.

## Benefits

- The feature can go through the auto-resolve pipeline one small issue at a time, in a safe order.
