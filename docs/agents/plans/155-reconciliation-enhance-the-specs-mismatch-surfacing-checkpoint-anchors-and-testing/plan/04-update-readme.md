# Update the README (Delivery, Open concerns, Alternatives, Testing overview)

Bring `README.md` in line with steps 02 and 03:

- **Alternatives considered**: add a **Checkpoint anchors** bullet (each finished statement
  becomes a new balance anchor): rejected, with the three reasons in one or two sentences, linking
  to `security.md#decided`.
- **Delivery**: phase 2 is complete. Roles, security and data access were settled by #153,
  migration, performance, memory and caching by #154, and mismatch surfacing, checkpoint anchors
  and testing by #155. The specs are ready for phase 3. Keep the sub-issue → file map TBD (phase 3
  fills it in), but if the lifecycle e2e spec suggests where it belongs (likely the "backend
  reconciliation API" sub-issue), note that in the likely-file column.
- **Open concerns**: none remain. Everything is settled in `security.md#decided`. Remove the
  "What remains…" sentence.
- **Testing overview**: name the new lifecycle e2e spec (with both base paths) in the intro or as
  its own table row ("End-to-end lifecycle → api/reconciliations.md"). Keep the sentence that
  `accountant.e2e-spec.ts` and the bill-payment specs must stay green and unchanged. State that
  the frontend uses Jasmine specs only (`ui/reconcile.md`, `ui/ledger.md`).
- **Overview / Product decision**: add the decided "Mismatch surfacing — difference bar and
  warning badge only" row to the Product decision table if it fits the table's style. Otherwise
  leave the table as is.

Finally, grep the folder for leftover "#155", "provisional" and "Open concerns" references and
make sure each one reads as settled.

## Files to Change

- `docs/agents/specs/reconciliation/README.md`: Alternatives considered, Delivery, Open
  concerns, Testing overview, and optionally the Product decision table.
