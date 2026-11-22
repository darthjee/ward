# Issue: Reconciliation — enhance the specs: roles, security and data access

## Description

Phase 2 of epic #85 (Reconciliation). Refine `docs/agents/specs/reconciliation/`, written by #152, on roles, security and data access. The initial specs record provisional defaults for these in `security.md` (Open concerns), `api/reconciliations.md` (Min role column) and `ui/reconcile.md` / `ui/ledger.md` (role gating). This issue confirms or revises them and removes the "provisional" markers. Migration, performance, memory and caching belong to #154; mismatch surfacing, checkpoint anchors and testing to #155.

## Problem

The provisional minimum roles are `user` for start, edit, tick and finish, and `admin` for cancel and undo. They are the working default, kept unless the review finds a problem, but nobody has confirmed them against the organization permission model (#143–#145). The new routes and 409 paths have had no `security`, `data-access` or `product-owner` review. Reconciliation adds locks that no role can bypass, `admin` included, so these rules need to be settled before implementation.

## Expected Behavior

The spec states, without provisional markers:
- The minimum role for each reconciliation action (start, edit, tick, finish, undo, cancel), consistent with the organization permission model, and how the frontend gates the Reconcile, Finish, Undo and Cancel controls through `orgPermissions.js` `MIN_ROLE` and `useCan`.
- Data access: every reconciliation route is scoped to accounts the caller can see (uniform 404, no global `is_admin` bypass), and the response fields, including the new account fields, expose nothing outside that scope.
- Whether the account list needs `last_reconciliation` and `open_reconciliation_id`, or only the account detail does. This closes that open concern in `security.md`.
- A security review of the new routes and the new 409 paths, covering bulk-tick input validation, statement date and balance bounds, and the concurrency of one open statement per account.

## Solution

The architect updates `security.md`, `api/reconciliations.md` and the UI specs after consulting the `security`, `data-access` and `product-owner` agents. Documentation only: no code changes.

## Benefits

- Implementation issues (#156) get a settled permission and security contract.
