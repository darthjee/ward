# Permission and error messages

**Permission.** Add `UNDO_RECONCILIATION: 'undo_reconciliation'` to `ACTIONS` and a `MIN_ROLE` row
mapping it to `ROLES.ADMIN`. The `can` JSDoc ("WRITE needs user, every other action needs admin")
stays true. In `orgPermissionsSpec.js`, add the `MATRIX` row `{ user: false, admin: true, owner:
true }`. The "covers every action" test fails without it.

**Error messages.** Add `B/reconciliation/controllers/reconciliationErrors.js`:

- `RECONCILIATION_MESSAGES`, a `Map` from each code to a fixed user-facing message:
  `RECONCILIATION_UNBALANCED` ("The difference must be 0 to finish."), `RECONCILIATION_OPEN`,
  `RECONCILIATION_OUT_OF_ORDER`, `RECONCILIATION_NOT_LATEST`, `RECONCILIATION_FINISHED`,
  `TRANSACTION_NOT_ELIGIBLE`, `TRANSACTION_CLEARED` and `ACCOUNT_RECONCILED`. Choose short, clear
  English text for each.
- `classifyReconciliationError(error)`, which returns `classifyError(error)`. When
  `RECONCILIATION_MESSAGES.has(classified.code)`, it overrides `message` and sets
  `messages: [message]`, like `placeError` in `BillFormController.js`. Unmapped codes keep the
  server message. `sessionExpired`, `transient` and `forbidden` pass through unchanged.

Spec `reconciliationErrorsSpec.js`:

- one test per mapped code;
- an unmapped code (`RECONCILIATION_NOT_FINISHED`) falls back to the server message;
- a 403 keeps the permission message;
- one rendering test passes a classified error to `BankErrorAlert` and checks that the mapped
  message is shown.

`TRANSACTION_CLEARED` and `ACCOUNT_RECONCILED` are raised by existing routes owned by #168's
screens. This step only provides the map entries. #168 may import the map.

## Files to Change
- `frontend/assets/js/utils/permissions/orgPermissions.js` — new action and `MIN_ROLE` row.
- `frontend/specs/assets/js/utils/permissions/orgPermissionsSpec.js` — `MATRIX` row.
- `frontend/assets/js/components/resources/bank/common/reconciliation/controllers/reconciliationErrors.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/controllers/reconciliationErrorsSpec.js` — new.
