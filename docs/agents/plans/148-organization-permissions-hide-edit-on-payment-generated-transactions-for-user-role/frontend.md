# Frontend Plan: Organization permissions: hide Edit on payment-generated transactions for user role

Main plan: [plan.md](plan.md)

## Shared contracts

The frontend can rely on:

- Each ledger row (`state.data.ledger.transactions[]`) has `payment_generated: boolean`, read
  directly as `transaction.payment_generated` (no camelCase mapping anywhere in the client).
- The POST/PATCH responses carry the same field, but nothing reads them: `LedgerFormController`
  reloads the ledger after a save, so no change is needed there.
- Rule: show Edit when `!transaction.payment_generated || can(role,
  ACTIONS.EDIT_PAYMENT_TRANSACTION)`. The action already exists in
  `assets/js/utils/permissions/orgPermissions.js` (admin and above).

## Implementation Steps

All paths are under `frontend/`.

### Step 1 — Expose the permission through the account detail state

- `assets/js/components/resources/bank/common/detail/hooks/useAccountDetail.js`: next to
  `canDelete`, add `const canEditPaymentTransactions = useCan(ACTIONS.EDIT_PAYMENT_TRANSACTION);`
  and return it in `state`. Update the JSDoc.
- `assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx`: pass
  `canEditPaymentTransactions: state.canEditPaymentTransactions` into
  `LedgerTableHelper.render({...})`, next to `canDelete`. Update the JSDoc.
- Specs:
  - `useAccountDetailSpec.js`: the flag is `true` for `admin`/`owner` and `false` for `user`.
  - `AccountDetailHelperSpec.js`: the flag is passed through to the ledger table.

### Step 2 — Gate Edit in LedgerTableHelper

- `assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelper.jsx`: add a
  private `renderEdit(transaction, state, handlers)`, following the `renderDelete` pattern. It
  returns `null` when `transaction.payment_generated && !state.canEditPaymentTransactions`, and
  the Edit `Button` otherwise. `renderActions` uses it. The `readOnly` short-circuit stays.
- JSDoc: rewrite the `renderActions` comment (it says Edit is always offered because
  payment-generated rows cannot be told apart), and add `canEditPaymentTransactions` to the
  `state` list in the `render` JSDoc.
- `specs/.../detail/helpers/LedgerTableHelperSpec.js`:
  - add `payment_generated` to the local `ROWS` fixture (one row `true`, one `false`) and
    `canEditPaymentTransactions` to the `state()` builder;
  - a `user` (`canEditPaymentTransactions: false`) sees Edit on the ordinary row only;
  - with the permission, Edit shows on both rows;
  - keep "wires Edit and Delete per row" and "hides Delete but keeps Edit without the delete
    permission" passing (Edit still shows on ordinary rows).
- No visible marker or badge on payment-generated rows (out of scope).

## Files to Change
- `frontend/assets/js/components/resources/bank/common/detail/hooks/useAccountDetail.js` — new `canEditPaymentTransactions` state flag
- `frontend/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx` — pass the flag to the ledger table
- `frontend/assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelper.jsx` — `renderEdit`, JSDoc
- `frontend/specs/assets/js/components/resources/bank/common/detail/hooks/useAccountDetailSpec.js` — flag per role
- `frontend/specs/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelperSpec.js` — flag passed through
- `frontend/specs/assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelperSpec.js` — fixtures and Edit gating cases

## CI Checks

- `frontend`: `docker-compose run --rm ward_fe yarn test` (CI job: `jasmine`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- Depends on the backend field. Before the backend ships, `payment_generated` is `undefined`,
  so Edit shows on every row, as it does today. That is a safe fallback.
- `orgPermissionsSpec.js` already covers `EDIT_PAYMENT_TRANSACTION`, so it needs no change.
