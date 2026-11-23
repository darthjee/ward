# Plan: Reconciliation — enhance the specs: mismatch surfacing, checkpoint anchors and testing

Issue: [155-reconciliation-enhance-the-specs-mismatch-surfacing-checkpoint-anchors-and-testing.md](../../issues/155-reconciliation-enhance-the-specs-mismatch-surfacing-checkpoint-anchors-and-testing.md)

## Overview

This is a documentation-only refinement of `docs/agents/specs/reconciliation/`, the last
spec-enhancement issue of phase 2 of epic #85. It records two decisions (no mismatch surfacing
beyond the difference bar and the warning badge, and checkpoint anchors rejected). It also
gap-reviews every file's **Required tests** against the lifecycle and lock rules, and names a
dedicated end-to-end lifecycle spec. Afterwards `security.md` has no open concerns left, and the
README's Delivery, Open concerns and Testing overview sections say the specs are ready for
phase 3. No code changes.

## Context

- `security.md` § Open concerns still lists two provisional defaults for #155: mismatch
  surfacing ("recommend none") and checkpoint anchors ("recommend rejecting").
- The README § Alternatives considered lists four rejected alternatives, but not checkpoint
  anchors. § Delivery and § Open concerns still say #155 is pending.
- Each spec file ends with a Required tests section (`model.md`, `api/reconciliations.md`,
  `api/existing-routes.md`, `ui/reconcile.md`, `ui/ledger.md`, `security.md`). Nobody has
  cross-checked them against the lifecycle table (`model.md` § Statement lifecycle: start, edit,
  tick/untick, finish, undo, cancel) or the lock matrix (`model.md` § Lock matrix:
  `TRANSACTION_CLEARED`, `ACCOUNT_RECONCILED`, `CURRENCY_LOCKED`).
- The backend e2e specs live in `backend/src/bank/tests/*.e2e-spec.ts` (e.g.
  `accountant.e2e-spec.ts`, `bill-payments.e2e-spec.ts`, `transactions.e2e-spec.ts`,
  `accounts.e2e-spec.ts`, `org-roles.e2e-spec.ts`). `api/reconciliations.md` already names
  `reconciliations.e2e-spec.ts` for per-route and per-error-code coverage. The new lifecycle spec
  is a separate, scenario-style file.
- The issue's Solution requires the architect to consult the `backend` and `frontend` agents on
  the test gaps before editing. That consultation is read-only: neither agent edits files for
  this issue.

## Steps

- [01 — Consult backend and frontend on the test gaps](plan/01-consult-test-gaps.md)
- [02 — Record the mismatch-surfacing and checkpoint-anchor decisions](plan/02-record-decisions.md)
- [03 — Apply the Required tests gap review and name the lifecycle e2e spec](plan/03-apply-test-gaps.md)
- [04 — Update the README (Delivery, Open concerns, Alternatives, Testing overview)](plan/04-update-readme.md)

## Notes

- Documentation only. No file outside `docs/agents/specs/reconciliation/` changes, so no CI job
  is affected. The existing `accountant.e2e-spec.ts` and the bill-payment specs are not touched,
  and the spec must keep saying they stay green and unchanged.
- Suggested name for the new spec: `backend/src/bank/tests/reconciliation-lifecycle.e2e-spec.ts`,
  next to the other bank e2e specs. If the `backend` agent points to a better naming convention
  in step 01, use that and keep the name consistent in `api/reconciliations.md` and the README.
- Don't add new product scope while doing the gap review (no list badge, no notifications, no
  new error codes). Gaps are only missing **tests** for rules the spec already states. If the
  review finds a rule that is ambiguous or contradicts another file, fix the wording only when
  the intent is clear from the other spec files. Otherwise record it in the PR description and
  don't invent a rule.
- After this issue `security.md` § Open concerns is empty. Replace the section body with a
  one-line "None — all concerns settled by #153, #154 and #155" rather than removing the
  heading, because the README and other files link to `security.md#open-concerns`. Or update
  every inbound link if the heading is removed.
