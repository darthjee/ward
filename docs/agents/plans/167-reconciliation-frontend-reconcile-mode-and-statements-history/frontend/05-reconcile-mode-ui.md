# Reconcile mode UI: header button, summary bar, checkbox column

**Header button** (`B/detail/helpers/AccountHeaderHelper.jsx`). Add a private
`renderReconcileButton(state, handlers)` to the actions row, next to Edit and Archive.

- It returns null when `account.archived_at` is set, or when `state.reconcile.canWrite` is false.
- Its label is **Continue reconciliation** when `account.open_reconciliation_id` is set, and
  **Reconcile** otherwise.
- It calls `handlers.reconcile.onReconcile`.

Add `reconcile` to the header object built in `AccountDetailHelper.renderLoaded`. Keep the edit
small, because #168 edits this file too.

**`B/reconciliation/helpers/ReconcileSectionHelper.jsx`**, `render(state, handlers)`:

- `mode: 'off'`: null.
- `mode: 'form'`: `StatementFormHelper.render`.
- `mode: 'active'`: the sticky summary bar (`<div className="sticky-top ...">`):
  - statement date, statement balance (debt negated for display), cleared balance and
    **Difference** (via `formatMoney`, highlighted with a warning class unless
    `isZeroAmount(difference)`);
  - **Finish**, disabled unless `isZeroAmount(difference)`;
  - **Edit statement**;
  - **Cancel**, only when `canCancel`;
  - the **Show only uncleared** checkbox, and **Tick all on page** and **Untick all**;
  - the `BankErrorAlert`;
  - a `ConfirmModal` for Cancel (title "Cancel reconciliation", confirmLabel "Cancel
    reconciliation").

`AccountDetailHelper.renderLoaded` renders it right after the `renderAfterHeader` slot, so the
Providers slot keeps working. If the file grows past the limit, move this placement into a small
`B/reconciliation/helpers/reconcileLayout.js`.

**Checkbox column** (`B/detail/helpers/LedgerTableHelper.jsx`). The ledger state gains an optional
`reconcile` (`{ account, statement, ticked, onlyUncleared }`), passed by `AccountDetailHelper` only
when the mode is `active`. When it is present:

- a leading `<th>` "Cleared" column is added;
- `renderRow` adds a `<td>` with a checkbox (`aria-label` "Tick <description>"). It is checked from
  `isTicked`, `disabled` unless `isEligible` or `busy`, and calls `handlers.reconcile.onToggle(row)`;
- an ineligible row gets a dimmed class (`text-muted opacity-50`);
- `renderOpening` adds an empty `<td>` with no checkbox;
- the rows are filtered through `visibleRows` when `onlyUncleared` is set.

Put the checkbox cell in a new `B/reconciliation/helpers/TickCellHelper.jsx` so that
`LedgerTableHelper` stays small and conflicts with #168 stay limited. The inline transaction form
stays rendered in reconcile mode. A new row appears after the reload and can then be ticked.

Specs:

- `AccountHeaderHelperSpec.js`:
  - the button is hidden when archived and when `canWrite` is false;
  - the label is **Reconcile** or **Continue reconciliation**;
  - the click calls the handler.
- `ReconcileSectionHelperSpec.js`:
  - the summary bar shows its four values, with the highlight unless the difference is 0;
  - Finish is disabled at a non-zero difference and enabled at 0;
  - Cancel is hidden when `canCancel` is false;
  - the confirm modal;
  - the bulk buttons call their handlers.
- `LedgerTableHelperSpec.js` (reconcile cases):
  - the column appears only in active mode;
  - checkboxes are enabled or disabled by eligibility, ineligible rows are dimmed, and the opening
    row has no checkbox;
  - the uncleared filter.
- `AccountDetailHelperSpec.js`:
  - the section renders after the header slot;
  - after a finish the mode is gone (no summary bar, no checkbox column);
  - the inline form is still present in active mode.
- Role gating through `OwnerContext.Provider` (in `useAccountDetailSpec` or the section spec):
  - `user` sees Reconcile, Edit statement, the checkboxes, the bulk ticks and Finish, but not
    Cancel;
  - `admin`, `owner` and the personal context also see Cancel.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/detail/helpers/AccountHeaderHelper.jsx` — `renderReconcileButton`.
- `frontend/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx` — pass `reconcile` to the header and the ledger, and render `ReconcileSectionHelper` after the header slot.
- `frontend/assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelper.jsx` — the optional checkbox column and the filter.
- `frontend/assets/js/components/resources/bank/common/reconciliation/helpers/ReconcileSectionHelper.jsx` — new.
- `frontend/assets/js/components/resources/bank/common/reconciliation/helpers/TickCellHelper.jsx` — new.
- `frontend/specs/assets/js/components/resources/bank/common/detail/helpers/AccountHeaderHelperSpec.js` — the button cases.
- `frontend/specs/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelperSpec.js` — placement, mode exit and the inline form.
- `frontend/specs/assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelperSpec.js` — the column cases.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/helpers/ReconcileSectionHelperSpec.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/helpers/TickCellHelperSpec.js` — new.
