# Remove the spec folder and close out the hub

Do this only after steps 01–03, once nothing in the permanent docs links into the spec.

- `git rm -r docs/agents/specs/reconciliation/`.
- `docs/agents/specs.md`: *Active specs* reads "none" (replace the table with the word, as the
  hub's lifecycle text says). Add a row at the **top** of *Completed specs*: "Reconciliation
  (statement checkpoints, cleared transactions and their lock); built by #164 to #168, specs
  were `specs/reconciliation/`, removed by #157". Under *Folded into*, link
  `modules/bank/reconciliation.md`, `modules/bank/transactions.md`, `modules/bank/accounts.md`,
  `modules/bank/bills.md`, `modules/bank/ui.md` and
  `backend/routes/bank.md#reconciliations`. Under *Epic*, #85. Under *Follow-up epics*, the
  three new epics from step 03.
- Check `docs/agents/summary.md` and `docs/agents/index.md`. They should link only to the hub,
  but if either names the reconciliation spec as active, update it.
- Final check: `grep -rn "specs/reconciliation" . --exclude-dir=node_modules --exclude-dir=.git | grep -v "docs/agents/issues/\|docs/agents/plans/"`
  must return only the backend comments (fixed by the backend agent next), or nothing once
  backend has run.
- When the PR is opened, its body must close both #157 and #85.

## Files to Change
- `docs/agents/specs/reconciliation/` — deleted (README, model, security, api/*, ui/*)
- `docs/agents/specs.md` — Active specs "none", new Completed specs row with follow-up epics
- `docs/agents/summary.md` / `docs/agents/index.md` — only if they mention the active spec
