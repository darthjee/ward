# Issue: Reconciliation — write the initial specs

## Description

Phase 1 of epic #85 (Reconciliation). Turn the decisions recorded in #85 into a feature spec folder, `docs/agents/specs/reconciliation/`, and register it as an active spec in `docs/agents/specs.md`. Documentation only, no code changes.

Reconciliation lets the user match an account's ledger against a bank statement. Each reconciliation is a statement checkpoint (statement date and statement balance). The user ticks the ledger rows present on the statement, and Ward shows the difference live. Finishing is allowed only when the difference is 0, and it marks the ticked rows as cleared. Cleared rows have `amount` and `date` locked and cannot be deleted.

## Problem

The decisions in #85 (data model, lifecycle, lock rules, routes, UI) exist only in the issue text. The later phases (spec enhancement, implementation issues, fold into permanent docs) need a spec folder to refine and implement against.

## Expected Behavior

- `docs/agents/specs/reconciliation/` exists. It follows the conventions in `docs/agents/specs.md`: a `README.md`, one file per concern, and **Reference** and **Required tests** sections in every file.
- The specs cover:
  - the data model: the `bank_reconciliations` table, a nullable `reconciliation_id` on transactions, one open statement per account, and the balance and difference formulas;
  - the statement lifecycle: start, tick, edit, cancel, finish, undo and history;
  - the lock rules for cleared transactions and for the account's opening anchor;
  - the new reconciliation routes and the changes to existing transaction, account and bill-payment routes;
  - the UI: reconcile mode, ledger markers, "Last reconciled" and Statements history.
- Concerns left for later sub-issues are recorded with a provisional suggested default.
- The `README.md` lists the delivery phases and a `## Future epics` section (statement import, statement-to-ledger drill-down, statement audit log).
- `docs/agents/specs.md` lists the new spec.

## Solution

Reuse the plan already written and committed on branch `issue-85` (`docs/agents/plans/85-reconciliation/`, commit 3719a78) instead of re-planning:

- Move the plan files to `docs/agents/plans/152-reconciliation-write-the-initial-specs/`, without re-exploring the codebase.
- Point the plan's issue link at this issue's file, and replace its "Part of #85" note: this sub-issue's PR closes #152 (`Fix #152`), while epic #85 stays open as the tracking issue.
- Delete the `issue-85` branch once the plan has moved. Its other commit (765beb7, the #85 issue file) is dropped with it. Epic issue files are not kept on `main`, and the specs are written from #85's GitHub issue body.

Model the spec folder on the former `split-provider` spec (#120). Permanent docs stay unchanged until the fold sub-issue.

## Benefits

- One source of truth for the reconciliation feature that the enhancement and implementation sub-issues can build on.
