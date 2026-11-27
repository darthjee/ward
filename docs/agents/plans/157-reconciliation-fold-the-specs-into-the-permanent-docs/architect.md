# Architect Plan: Reconciliation — fold the specs into the permanent docs

Main plan: [plan.md](plan.md)

## Shared contracts

The architect **produces** the headings the backend comments will cite. Create them with exactly
these names (see [plan.md](plan.md#shared-contracts) for the full mapping):

- `docs/agents/modules/bank/reconciliation.md`: `## Reconciliation entity`, `## Formulas`
  (with `### Queries and indexes`), `## Statement lifecycle`, `## Lock matrix`, `## Migration`,
  `## Concurrency`, `## Memory`, `## Data sensitivity and ownership`.
- `docs/agents/backend/routes/bank.md`: `## Reconciliations`, `### Reconciliation check order`,
  `### Reconciliation error codes`, `### Reconciliation caching`,
  `## Reconciliation locks on existing routes`.

If a heading has to change, update `plan.md`'s contract table in the same PR, before the backend
step runs.

## Steps

- [01 — Write the reconciliation concern page and update the bank model pages](architect/01-model-pages.md)
- [02 — Update the routes, UI and cross-cutting pages](architect/02-routes-ui-and-cross-cutting.md)
- [03 — Open the three follow-up epics and record their URLs](architect/03-follow-up-epics.md)
- [04 — Remove the spec folder and close out the hub](architect/04-remove-spec.md)

## CI Checks

This is a docs-only change for the architect, so no CI job covers `docs/agents/`. Before
handing over, check the links by hand: every relative link in a changed file must resolve, and
every `#anchor` must match a heading in its target. Then run
`grep -rn "specs/reconciliation" docs/agents --include=*.md | grep -v "docs/agents/issues/\|docs/agents/plans/"`,
which must return nothing.

## Notes

- **Split deviation.** The skill's rule excludes the coordinator from the agent split. Here the
  coordinator owns most of the work (the issue says "Architect-owned documentation change"), and
  backend only has a comment repoint. A `backend.md`-only plan would hand the docs to the wrong
  agent, so `architect.md` is listed explicitly. This follows the precedents of #58/#105, #126
  and #145.
- **Shipped behavior, not spec prose.** Write in the present tense, drop "the implementation
  issue may…", "recommendation, not a hard rule", the file → sub-issue map, the delivery
  phases, the review logs (§ Review (#154), § Decisions and test review (#155), § Security
  review (#153)) and the per-file *Required tests* lists. Tests live in the code. Where a spec
  sentence names a planned implementation choice, such as the `LEFT JOIN` placement in the
  ledger query, check it against the merged code (`backend/src/bank/ledger.query.ts`,
  `reconciliation*.ts`, `transaction.writer.ts`) and record what shipped. The implementation
  PRs (#171 to #174) changed no spec file, so the spec should match the code, but spot-check
  the error codes in `backend/src/core/error-codes.ts` and the routes in
  `backend/src/bank/reconciliations.controller.ts`.
- Follow the doc conventions of the existing `modules/bank/*.md` pages: an *Alternatives
  considered* section, a *Deferred* section with epic links, and *Differences from the original
  spec* where something changed.
- Creating the epics (step 03) is a GitHub side effect. Do it once only: before creating, check
  with `gh issue list --label Epic --search "<title> in:title" --state all` that no epic with
  that title exists yet.
- #85 is closed by the PR body (`Closes #85` next to `Closes #157`), not by hand.
