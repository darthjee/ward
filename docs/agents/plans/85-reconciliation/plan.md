# Plan: Reconciliation

Issue: [85-reconciliation.md](../../issues/85-reconciliation.md)

## Overview

Epic #85 is delivered spec-first. This plan covers **phase 1 — initial spec writing**: turn
the decisions recorded in the issue into a feature spec folder,
`docs/agents/specs/reconciliation/`, and register it as an active spec in
`docs/agents/specs.md`. No code changes. The spec becomes the source of truth for the later
phases (spec enhancement, creating the implementation issues, fold into permanent docs). Those
phases are recorded in the spec's `README.md` and are not done here.

All work is documentation under `docs/agents/`, owned by the architect. No specialist agent
(`backend`, `frontend`, `cache`, `infra`, `proxy`) has files to change in this phase, so the
plan is not split by agent. The `backend` and `frontend` agents explored the code read-only,
and their findings are written into the steps so the specs point at the right files and
conventions.

## Context

- **What reconciliation is.** A per-account **statement checkpoint** (statement date and
  statement balance). The user ticks the ledger rows that appear on the bank statement, and
  Ward shows the difference live. Finishing is allowed only when the difference is 0, and it
  marks the ticked rows as **cleared**. Cleared rows have `amount` and `date` locked and
  cannot be deleted (409 `TRANSACTION_CLEARED`). The latest finished statement can be undone.
- **Decisions to respect:**
  - Balances stay computed from the ledger plus the opening anchor; they are never stored
    ([transactions.md](../../modules/bank/transactions.md#balance)).
  - The opening anchor is locked once any finished statement exists (409
    `ACCOUNT_RECONCILED`).
  - Ticks are stored as a nullable `reconciliationId` FK on `Transaction`. A row is *ticked*
    when it is linked to the `open` statement and *cleared* when it is linked to a `finished`
    one.
- **Spec conventions** come from [specs.md](../../specs.md#conventions):
  - one `README.md` per feature, with the files split by concern;
  - every file ends with **Reference** (GitHub URLs only, never local paths) and **Required
    tests** sections;
  - a `## Future epics` section in the README;
  - specs describe decisions, not code.

  The model to follow is the `split-provider` spec, which was written by #120 and removed by
  #126 (`git show 0029086:docs/agents/specs/split-provider/README.md`).
- **Scope of the epic's open concerns.** The epic leaves several concerns to phase 2 ("spec
  enhancement"): roles, backward compatibility and migration, testing strategy, performance
  and security, owning module, memory, caching, mismatch surfacing, and checkpoint anchors as
  an alternative. Phase 1 writes the decided parts. For each open concern it writes a
  **recommended default**, clearly marked *provisional — to be settled in spec enhancement*,
  so phase 2 has something concrete to confirm or revise.

## Steps

- [01 — Spec folder README and hub registration](plan/01-readme-and-hub.md)
- [02 — Data model and lock rules](plan/02-model.md)
- [03 — Reconciliation API](plan/03-api-reconciliations.md)
- [04 — Changes to existing routes](plan/04-api-existing-routes.md)
- [05 — UI specs](plan/05-ui.md)
- [06 — Security, open concerns and testing](plan/06-security-and-open-concerns.md)

## Notes

- **Closing the epic.** This PR delivers phase 1 only. Its description should say
  `Part of #85`, not `Fix #85` / `Closes #85`, so the epic stays open for phases 2–4. If the
  resolve workflow always closes the issue it fixes, the user may prefer to split #85 first
  (`/arcanum-split-issue`) and run this plan as the phase-1 sub-issue, the way #120 was split
  from #119.
- **Permanent docs stay unchanged.** `transactions.md`, `accounts.md`, `bills.md`, `ui.md`
  and `backend/routes/bank.md` are rewritten at fold time (phase 4), not now. The only
  permanent file this phase touches is the `specs.md` hub, following the convention that root
  docs and indexes link to the hub and never to the spec folder.
- **Route shapes, response fields and error codes are proposals.** They are written as
  decisions so the implementation issues have a contract, but phase 2 may revise any of them.
  A later sub-issue that changes a decision updates the spec in the same PR.
- **Interactions.** Linked transfers (#86) stay out of scope. Ledger filters (#90) are
  independent of the local "Show only uncleared" toggle. The audit trail (#95) is not needed:
  there is no audit log in this epic.
- **Future epics.** Statement import (OFX/CSV), drilling from a statement to a filtered
  ledger, and a statement audit log go into the README's `## Future epics` section. They are
  not opened as GitHub issues now.
