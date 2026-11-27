# Docs (architect)

This step belongs to the **architect**, because `docs/agents/` is outside the frontend scope.
Run it after steps 01–04 land.

In `docs/agents/modules/bank/ui.md`, add a short "Reconciliation markers" note:

- **Ledger badges.** The cleared marker (finished statement, with the date in the tooltip) and
  the warning badge (an uncleared row dated on or before `last_reconciled_date`). Both render
  inside the description cell of the shared ledger table for all four types.
- **Cleared rows.** `amount`, `date` and the direction toggle are read-only, and Delete is
  hidden.
- **Header line.** "Last reconciled: <date> · <balance>", negated on debts.
- **Edit form.** The opening fields are read-only, and the currency is locked, whenever
  `last_reconciliation` or `open_reconciliation_id` is set.

Link to `docs/agents/specs/reconciliation/ui/ledger.md` instead of copying it.

## Files to Change
- `docs/agents/modules/bank/ui.md` — reconciliation markers note
