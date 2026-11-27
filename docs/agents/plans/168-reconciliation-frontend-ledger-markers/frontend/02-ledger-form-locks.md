# Locked fields in the ledger form

`B/detail/helpers/LedgerFormHelper.jsx` is the single create / edit form above the table.
`state.form.editing` is the full ledger row, so it already carries `reconciliation`.

When `isCleared(state.form.editing)` (from step 01):

- **Date and amount.** `renderControl` adds `readOnly: true` to the input's `extra` for the
  `date` and `amount` controls. `extra` is already spread onto the input.
- **Direction toggle.** `renderDirection` (Out / In) renders disabled, because toggling it
  changes the amount's sign.
- **Other fields.** Description, notes and any other fields stay editable.
- **Hint.** Optionally add a short `form-text` hint under the amount, such as "Cleared on a
  reconciled statement — undo the statement to change amount or date." Export it as a constant.

No change to `B/detail/controllers/ledgerFormFields.js` is needed for the submit. The PATCH
still sends `date` and `amount`, but the values are unchanged, and the server accepts unchanged
values. Do not filter the body. The 409 `TRANSACTION_CLEARED` stays the backstop.

Specs, in `S/detail/helpers/LedgerFormHelperSpec.js`:

- When editing a cleared row, `date` and `amount` are read-only and the direction toggle is
  disabled. Description and notes are editable.
- When editing an uncleared row or a row on an open statement, nothing is read-only.
- The create form (no `editing`) has nothing read-only.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/detail/helpers/LedgerFormHelper.jsx` — make `date` / `amount` read-only and disable the direction toggle on cleared rows
- `frontend/specs/assets/js/components/resources/bank/common/detail/helpers/LedgerFormHelperSpec.js` — locked-field cases
