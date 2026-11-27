# Open the three follow-up epics and record their URLs

Before the spec is removed, create one GitHub epic per entry in the spec README's
`## Future epics`, using `gh issue create` with labels `Idea` and `Epic`. Mirror the body shape
of the earlier follow-up epics (e.g. #86): `## What it covers`, `## Decisions it must respect`,
`## Where these decisions live` (GitHub `blob/main` URLs to the **new permanent** anchors, not
the spec), `## Origin` ("Deferred by the reconciliation specs of Epic #85, folded into the
permanent docs by #157."). Before each create, check that an epic with that title does not exist
yet (`gh issue list --state all --search "<title> in:title"`).

1. **Statement import**: upload an OFX or CSV statement and match its lines to ledger rows
   automatically. Must keep the tick and finish rules, the lock matrix and the difference.
   Points at `modules/bank/reconciliation.md` (*Statement lifecycle*, *Lock matrix*).
2. **Statement-to-ledger drill-down**: open the ledger filtered to one statement's rows from the
   Statements history. Must be written against the ledger filters of #90. Points at
   `modules/bank/ui.md` (statements history) and `modules/bank/reconciliation.md`.
3. **Statement audit log**: record who started, ticked, finished, undid and cancelled a
   statement. Links and overlaps #95 (Authorship / audit trail). Points at
   `modules/bank/reconciliation.md` (*Data sensitivity and ownership*).

Then record each URL where the permanent docs mention the deferred concern:

- `modules/bank/reconciliation.md` § Deferred: all three, plus #86 (cross-account / linked
  transfers) and #88 (currency conversion) from the spec's out-of-scope list;
- `modules/bank/ui.md` statements history: the drill-down epic;
- `modules/bank/transactions.md` § Deferred: statement import;
- `modules/bank/accounts.md` § Deferred: the audit-log epic, next to the existing #95 entry.

Keep the three new issue numbers for step 04.

## Files to Change
- `docs/agents/modules/bank/reconciliation.md` — § Deferred with the three new epic URLs
- `docs/agents/modules/bank/ui.md` — drill-down epic link
- `docs/agents/modules/bank/transactions.md` — statement import epic link
- `docs/agents/modules/bank/accounts.md` — audit log epic link
