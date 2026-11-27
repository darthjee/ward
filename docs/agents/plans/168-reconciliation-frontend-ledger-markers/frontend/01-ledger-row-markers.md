# Ledger row markers and hidden Delete

Add two small root-conditional components (each returns `null` when it does not apply), modelled
on `B/bills/OffScheduleBadge.jsx` and `B/list/ArchivedBadge.jsx`:

- **`B/reconciliation/ClearedMarker.jsx`**
  - Props: `{ transaction }`.
  - When `isCleared(transaction)`, it renders `<span className="badge text-bg-success ms-2">✓ cleared</span>`.
  - The span's `title` is the statement date, through `formatDate(transaction.reconciliation.statement_date)`
    from `B/dates.js` (display locale), e.g. `` `Cleared on statement of ${date}` ``.
  - Otherwise it renders `null`, which includes rows of an open statement.
- **`B/reconciliation/UnreconciledWarningBadge.jsx`**
  - Props: `{ transaction, lastReconciledDate }`.
  - When `!transaction.reconciliation && lastReconciledDate && transaction.date <= lastReconciledDate`,
    it renders `<span className="badge text-bg-warning ms-2">` with the text
    `` `Not on reconciled statement of ${formatDate(lastReconciledDate)}` ``. Export the text
    prefix or a builder as a constant.
  - Otherwise it renders `null`.

Add `isCleared(row)` to `B/reconciliation/controllers/eligibility.js`, next to `isEligible` and
`isTicked`.

In `B/detail/helpers/LedgerTableHelper.jsx`:

- **Description cell.** In `renderRow`, render `<ClearedMarker>` and `<UnreconciledWarningBadge
  lastReconciledDate={state.ledger?.last_reconciled_date}>` inside the description `<td>`.
  They go after the description / `renderNotes` and before `state.renderRowExtra?.(tx)`. Do not
  add a column. `renderOpening` stays untouched, so the opening row never gets a marker.
- **Delete action.** `renderDelete` returns `null` when `isCleared(transaction)`. Edit stays
  visible, because description and notes are still editable.

Specs:

- **Component specs.** One spec per new component, mirroring its path:
  - the marker shows for `finished`, with the date in `title` (`containsAttribute('title', ...)`);
  - the marker is absent for `open` and for `null`;
  - the badge shows for a row dated before the last statement, and for one dated exactly on it;
  - the badge is absent for a later row, when `lastReconciledDate` is `null`, and on cleared or
    open-statement rows.
- **Table spec.** Put the table-level cases in a new
  `S/detail/helpers/LedgerTableHelperReconciliationSpec.js`, because `LedgerTableHelperSpec.js`
  is already at 247 lines. Cover:
  - the marker and the badge rendered for all row types through the shared table;
  - Delete hidden on a cleared row and still present on an uncleared one;
  - Edit still present on a cleared row;
  - the marker still present when the section uses `renderRowExtra` (providers).
- **Eligibility spec.** Add `isCleared` cases to `S/reconciliation/controllers/eligibilitySpec.js`
  (create it if missing).

## Files to Change
- `frontend/assets/js/components/resources/bank/common/reconciliation/ClearedMarker.jsx` — new
- `frontend/assets/js/components/resources/bank/common/reconciliation/UnreconciledWarningBadge.jsx` — new
- `frontend/assets/js/components/resources/bank/common/reconciliation/controllers/eligibility.js` — add `isCleared`
- `frontend/assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelper.jsx` — render the markers in the description cell, and hide Delete on cleared rows
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/ClearedMarkerSpec.js` — new
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/UnreconciledWarningBadgeSpec.js` — new
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/controllers/eligibilitySpec.js` — `isCleared` cases
- `frontend/specs/assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelperReconciliationSpec.js` — new
