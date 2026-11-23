# Record the mismatch-surfacing and checkpoint-anchor decisions

Move both #155 concerns from **Open concerns** to **Decided** in `security.md`:

- **Mismatch surfacing** row in the Decided table: none beyond the reconcile-mode difference bar
  and the ledger warning badge. No account-list indicator and no notifications in this epic. The
  account detail fields (`last_reconciliation`, `open_reconciliation_id`) stay off the list
  payload, as the existing *Account payload* row already says. Reword that row's "If a later
  list badge needs them (see Open concerns)" so it no longer points to an open concern (for
  example "If a future epic adds a list badge, …").
- **Checkpoint anchors** row in the Decided table: rejected. Balances stay computed as the
  opening anchor plus every cleared row (`model.md` § Formulas). Reasoning, stated explicitly:
  1. no second source of truth for balances (no stored per-statement balance that could drift
     from the ledger);
  2. undo stays a plain revert of the latest statement (no re-anchoring to unwind);
  3. the cleared-row locks (`TRANSACTION_CLEARED`) already protect the history that a checkpoint
     would freeze.
- Rewrite § Open concerns: no concern remains. Keep the heading, because inbound links target
  `security.md#open-concerns`, with a one-line body saying everything was settled by #153, #154
  and #155. Update the file's intro paragraph ("…and the concerns still deferred to later
  spec-enhancement issues") to match.
- Optionally add a short `### Decisions (#155)` note next to `### Review (#154)` and
  `### Security review (#153)`, saying the `backend` and `frontend` agents reviewed the test
  lists (filled in from step 01).

In `model.md`, if a sentence under § Formulas or the README's Product decision table ("Balances
— Still computed; no per-statement opening balance stored") should link to the new decision, add
the link. Don't duplicate the reasoning there.

## Files to Change

- `docs/agents/specs/reconciliation/security.md`: two new Decided rows, the Account payload row
  reworded, § Open concerns emptied, the intro updated, an optional #155 review note.
- `docs/agents/specs/reconciliation/model.md`: at most a cross-link from § Formulas to the
  checkpoint-anchors decision.
