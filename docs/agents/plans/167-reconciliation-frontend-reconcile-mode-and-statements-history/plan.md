# Plan: Reconciliation: frontend reconcile mode and statements history

Issue: [167-reconciliation-frontend-reconcile-mode-and-statements-history.md](../../issues/167-reconciliation-frontend-reconcile-mode-and-statements-history.md)

## Overview

Build the reconcile workflow in the shared `bank/common` detail page so all four account types
get it: a new `ReconciliationsClient.js` spread into `BankClient`, the new
`UNDO_RECONCILIATION` action, a reconciliation error-message map, the start and edit statement
forms (with debt negation), reconcile mode (header button, summary bar, checkbox column, bulk
ticks, Show only uncleared, Finish and Cancel), and the Statements history section with Undo.
All code changes are in `frontend/`. The backend API (#165, #166) is already merged.

See [frontend.md](frontend.md) for the full plan.

## Review and documentation (outside the frontend plan)

- No new endpoint is added, so `cache` and `security` have nothing new to review. The UI only
  hides controls; the backend 403 stays the enforcement.
- #168 runs in parallel and also edits `AccountHeaderHelper.jsx`, `LedgerTableHelper.jsx` and
  `AccountDetailHelper.jsx`. Whichever lands second rebases and resolves the conflicts.
