# Draft the five sub-issue bodies

Write one body per sub-issue in the repo's issue format (`# Issue: <title>`, `## Description`,
`## Problem`, `## Expected Behavior`, `## Solution`, `## Benefits`, the same shape as #157). Each
body must make sense on its own. It states that it is part of epic #85, links
`docs/agents/specs/reconciliation/` as the source of truth, lists the exact spec files to read,
names the **Required tests** sections it must satisfy, lists its dependencies by title (their
numbers are filled in or edited in step 02), and names the owning specialist agent.

Write the bodies to the scratchpad, then generate the local draft files in the order below
(1 to 5), so that the count prefixes match the dependency order:

```bash
<arcanum-split-issue>/scripts/create_sub_issue_file.sh "$REPO_PATH" 85 "<title>" <body_file>
```

The five sub-issues:

1. **Reconciliation — backend: migration and entity** (agent `backend`)
   - Reads: `model.md`, `security.md`.
   - Scope: the `reconciliations` table, the `reconciliation_id` FK on `bank_transactions`
     (`ON DELETE SET NULL`), the `account_id` cascade, the unique-open index, the
     `Reconciliation` entity and the `Transaction` change, the formula and eligibility helpers,
     the 409 conflict factories, and the test-support extension (fake data source repository,
     in-memory rules, `'ReconciliationsController'` in `KNOWN_CONTROLLERS`, migration in
     `MIGRATIONS`).
   - Tests: `model.md` § Required tests; the migration, concurrency and memory bullets of
     `security.md` § Required tests.
   - Depends on: nothing.
2. **Reconciliation — backend: reconciliation API** (agent `backend`)
   - Reads: `model.md`, `api/reconciliations.md`, `security.md`.
   - Scope: the new routes, payloads, check order, error codes, cache classes
     (`X-Cache-Allow` user-scoped GETs, `X-Skip-Cache` writes), the `x-cache-invalidate`
     invalidation, and the lazy loading. Includes the new
     `backend/src/bank/tests/reconciliation-lifecycle.e2e-spec.ts`, run under both `/bank` and
     `/orgs/<id>/bank`.
   - Tests: `api/reconciliations.md` § Required tests (both `reconciliations.e2e-spec.ts` and
     the lifecycle spec); `security.md` § Required tests (ownership, bounds, roles,
     cache/invalidation, lazy loading).
   - Depends on: issue 1. Needs a `security` and a `cache` review.
3. **Reconciliation — backend: locks on existing routes** (agent `backend`)
   - Reads: `model.md`, `api/existing-routes.md`.
   - Scope: the transaction lock matrix (`TRANSACTION_CLEARED`, auto-untick), the account anchor
     and currency locks (`ACCOUNT_RECONCILED`, `CURRENCY_LOCKED`), the
     `last_reconciliation` / `open_reconciliation_id` fields on the account detail, the ledger
     `reconciliation` field and `last_reconciled_date`, the three bill-payment undo routes,
     and the cache classes of the changed routes. `accountant.e2e-spec.ts` and the
     bill-payment specs must stay green.
   - Tests: `api/existing-routes.md` § Required tests.
   - Depends on: issue 1 (it can run in parallel with issue 2). Needs a `security` and a `cache`
     review.
4. **Reconciliation — frontend: reconcile mode and Statements history** (agent `frontend`)
   - Reads: `api/reconciliations.md`, `api/existing-routes.md`, `ui/reconcile.md`,
     `ui/ledger.md` (§ Statements history and § Errors).
   - Scope: the header Reconcile / Continue button, role gating (`UNDO_RECONCILIATION`
     `MIN_ROLE`), the start and edit forms with debt negation, reconcile mode (checkboxes,
     bulk ticks, Show only uncleared, summary bar, Finish, Cancel), the client methods, the
     Statements history section with Undo for all four account types, and the new
     `classifyError` codes.
   - Tests: `ui/reconcile.md` § Required tests; the History, History Undo and Error messages
     bullets of `ui/ledger.md` § Required tests.
   - Depends on: issue 2.
5. **Reconciliation — frontend: ledger markers** (agent `frontend`)
   - Reads: `api/existing-routes.md`, `ui/ledger.md`.
   - Scope: the cleared marker, the locked `amount` / `date` fields and the hidden delete on
     cleared rows, the warning badge, the header line, and the read-only opening fields on the
     account edit form.
   - Tests: the Cleared marker, Locked fields, Warning badge, Header line and Account edit form
     bullets of `ui/ledger.md` § Required tests.
   - Depends on: issue 3.

Split `ui/ledger.md` cleanly between issues 4 and 5 (history, undo and errors go to 4; markers,
locks, badge, header line and edit form go to 5), and say so explicitly in both bodies so they
never claim the same test.

## Files to Change

- `docs/agents/issues/85_0N_*.md` — temporary local drafts written by
  `create_sub_issue_file.sh`. Not committed.
