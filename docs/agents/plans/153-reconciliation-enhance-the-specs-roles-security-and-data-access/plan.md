# Plan: Reconciliation — enhance the specs: roles, security and data access

Issue: [153-reconciliation-enhance-the-specs-roles-security-and-data-access.md](../../issues/153-reconciliation-enhance-the-specs-roles-security-and-data-access.md)

## Overview

This is phase 2 of epic #85, and it covers roles, security and data access only. The architect
consults the read-only `product-owner`, `security` and `data-access` agents about the
reconciliation spec written by #152. It then settles the provisional defaults in
`docs/agents/specs/reconciliation/` and removes the "provisional" markers for these topics. The
work is documentation only: no code changes, and no implementation specialist (`backend`,
`frontend`, `infra`, `proxy`, `cache`) has work. The architect owns every edit, since
`docs/agents/` is its scope.

## Context

- The initial specs (#152, commit `9fb4767`) record provisional defaults:
  - `security.md` § Open concerns: Roles, and the Account list payload.
  - `api/reconciliations.md`: the "Min role" column, marked provisional. The proposal is `user`
    for start, edit, tick and finish, and `admin` for cancel and undo.
  - `api/existing-routes.md` § Accounts: whether the account list carries
    `last_reconciliation` and `open_reconciliation_id`.
  - `ui/reconcile.md` § Role gating: `ACTIONS.RECONCILE` and `ACTIONS.UNDO_RECONCILIATION` in
    `orgPermissions.js` `MIN_ROLE`, read through `useCan`, with roles marked provisional.
  - `ui/ledger.md`: Undo is shown "where `undoable` and allowed", with no named action.
  - `README.md` § Open concerns: a summary pointing at `security.md`.
- The organization permission model (#143–#145) is in `docs/agents/modules/auth/organizations.md`
  § Roles and `docs/agents/backend/routes/bank.md` § Minimum role. Its rule is that everyday
  writes need `user`, and every DELETE (payment undo included) and every account-structure write
  need `admin`. The personal context counts as `owner`, and global `is_admin` gets no bypass. The
  frontend hides controls through `useCan` (`docs/agents/architecture/frontend.md`).
- Gaps and inconsistencies found while exploring, for the reviewers to rule on:
  - **Check order.** `api/reconciliations.md` § Check order reads "Path 404, body 400, then 409"
    and leaves out the role 403. `OwnerContextGuard` throws 403 after owner resolution and
    before the handler, so the real order is 404 → 403 → 400 → 409.
  - **Date bound.** `security.md` says dates may be at most UTC today + 1 day. The POST row in
    `api/reconciliations.md` says a date "in the future" answers 400, and the UI uses `max`
    today. One rule has to be picked and stated in every file.
  - **Balance bound.** It is "at most 10¹³ minor units", but the spec does not say whether that
    applies to the absolute value, so negative balances (debts, overdrafts) are unbounded.
  - **Cancel and Finish gating.** Only `RECONCILE` and `UNDO_RECONCILIATION` are named. The
    spec does not say which action gates Cancel (`admin`) or Finish and Edit statement (`user`).
  - **Concurrency.** It covers the `SELECT … FOR UPDATE` row lock and the unique `open_key`.
    It does not cover two concurrent starts (the unique-key violation must map to 409
    `RECONCILIATION_OPEN`, never 500). It also does not cover a tick racing a transaction
    PATCH or DELETE on the same row, or an undo racing a start.
- Out of scope: migration, performance, memory and caching (#154), and mismatch surfacing,
  checkpoint anchors and testing strategy (#155). Their Open-concerns bullets stay in place,
  still marked provisional.

## Steps

- [01 — Consult the reviewers](plan/01-consult-reviewers.md)
- [02 — Settle roles and frontend gating](plan/02-settle-roles-and-gating.md)
- [03 — Settle data access and the account payload](plan/03-settle-data-access.md)
- [04 — Record the security review of routes and 409 paths](plan/04-security-review-of-routes.md)
- [05 — Clean up the markers and the README](plan/05-cleanup-markers-and-readme.md)

## Notes

- No CI job checks `docs/`, so there is nothing to run locally. Check by hand that the
  cross-file anchors still resolve (`security.md#open-concerns`, `api/reconciliations.md#error-codes`,
  and any new anchors).
- The provisional roles are "kept unless the review finds a problem". If a reviewer argues for a
  change (for example finish → `admin` because it locks rows that only `admin` could otherwise
  delete), the architect decides and records the reasoning in `security.md` § Decided.
- If a reviewer finding needs a product decision outside this issue's scope (for example a new
  owner-only action), record it in `README.md` § Future epics or leave it for #154 or #155. Do
  not widen this issue.
- Follow `docs/agents/specs.md` § Conventions: every touched file keeps its Reference section
  (GitHub web URLs only) and its Required tests section.
- The phase-3 implementation issues (#156) depend on this contract, so every decision must be
  explicit (route, role, status code, field), with nothing left as "TBD" for these topics.
