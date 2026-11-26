## Description

Part of epic #85 (Reconciliation: statement checkpoints). This issue builds the reconcile workflow in the frontend: the header button, the start and edit forms, reconcile mode, the client methods, and the Statements history section with Undo, for all four account types.

**Owner:** `frontend`. **Depends on:** #165 (reconciliation API). **Parallel with:** #168.

## Source of truth

The finished specs in [`docs/agents/specs/reconciliation/`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/README.md). Read these files:

- [`api/reconciliations.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/api/reconciliations.md) and [`api/existing-routes.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/api/existing-routes.md): the payloads and error codes the UI consumes.
- [`ui/reconcile.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/ui/reconcile.md): entry point, role gating, start/edit form, reconcile mode, client.
- [`ui/ledger.md`](https://github.com/darthjee/ward/blob/main/docs/agents/specs/reconciliation/ui/ledger.md): only § Statements history and § Errors belong to this issue.

## Problem

Even with the API in place, a user cannot start a statement, tick rows, see the live difference, finish, cancel or undo from the UI.

## Expected Behavior

- The header shows **Reconcile** (or **Continue reconciliation** when a statement is open), gated by role and archive state. `UNDO_RECONCILIATION` is added to `MIN_ROLE` (`admin`).
- The start and edit forms (with debt negation and the "Amount owed" label) and reconcile mode: the checkbox column and its eligibility, optimistic tick/untick with revert on error, bulk Tick all / Untick all, Show only uncleared, the summary bar with the live difference, Finish and Cancel.
- The client methods (`BankClient.js` or `ReconciliationsClient.js`) for the new routes, under both the personal and the org base paths.
- The Statements history section (newest first, open statement on top, pagination) with Undo for all four account types, mirroring the bill history.
- The new `classifyError` codes (`RECONCILIATION_UNBALANCED`, `RECONCILIATION_OPEN`, `RECONCILIATION_OUT_OF_ORDER`, `RECONCILIATION_NOT_LATEST`, `RECONCILIATION_FINISHED`, `TRANSACTION_NOT_ELIGIBLE`, `TRANSACTION_CLEARED`, `ACCOUNT_RECONCILED`).

## Required tests

This issue must satisfy:

- `ui/reconcile.md` § Required tests (every bullet).
- In `ui/ledger.md` § Required tests: the **History section**, **History Undo** and **Error messages** bullets only.

`ui/ledger.md` is split with #168: the Cleared marker, Locked fields, Warning badge, Header line and Account edit form bullets belong to #168. Neither issue claims the other's tests.

## Solution

Follow the specs, using Jasmine specs and the helpers in `frontend/specs/support/`. Run the frontend checks through `docker-compose run`. No end-to-end tooling is added.

## Benefits

- Users can reconcile an account against a bank statement from the UI.

