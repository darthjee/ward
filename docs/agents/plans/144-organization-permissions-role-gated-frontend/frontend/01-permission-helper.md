# Permission helper

Add a pure module that mirrors the backend matrix, so that every component asks one place
whether an action is allowed.

- Create `frontend/assets/js/utils/permissions/orgPermissions.js`, exporting:
  - `ROLES`: frozen `{ USER: 'user', ADMIN: 'admin', OWNER: 'owner' }`.
  - `ACTIONS`: frozen `{ WRITE, UNDO_PAYMENT, EDIT_PAYMENT_TRANSACTION, MANAGE_ACCOUNTS,
    RENAME_ORGANIZATION, DELETE }`, with string values.
  - `can(role, action)`, built on a rank table `user < admin < owner` and a minimum role per
    action:
    - `WRITE` needs `user`; every other action needs `admin`.
    - An unknown or `null` role returns `false` for every action, including `WRITE`.
    - An unknown action returns `false`.
- Add JSDoc comments, as the ESLint `jsdoc` plugin requires.
- Spec: run a table-driven loop over every role and every action, asserting the full matrix.
  Also cover `null` and `undefined` roles, an unknown role, and an unknown action.

## Files to Change
- `frontend/assets/js/utils/permissions/orgPermissions.js`: new helper.
- `frontend/specs/assets/js/utils/permissions/orgPermissionsSpec.js`: new spec.
