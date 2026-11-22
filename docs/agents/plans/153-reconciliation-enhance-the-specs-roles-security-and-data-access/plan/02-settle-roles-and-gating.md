# Settle roles and frontend gating

Apply the `product-owner` and `security` findings on roles. The default is to keep the
provisional matrix, unless a reviewer finds a problem: start, edit, tick and finish need `user`,
and cancel and undo need `admin`. GETs are open to every member, and the personal context counts
as `owner`.

- `api/reconciliations.md`:
  - Remove "The minimum roles are **provisional**" from the intro of § Routes.
  - Keep the Min role column with the final values, and state that each route uses
    `@MinOrgRole` enforced by `OwnerContextGuard`.
  - Add one sentence linking the pattern to `backend/routes/bank.md` § Minimum role: cancel is a
    DELETE, and undo reverses a finished statement like a payment undo.
- `security.md`:
  - Move **Roles** from § Open concerns to a "Roles" row in § Decided, with the final matrix
    and its reasoning.
  - Say that the lock has no role bypass: the locks are 409s checked after the role 403, so
    `admin` and `owner` hit them too.
- `ui/reconcile.md` § Role gating:
  - Remove "(provisional)".
  - Name every action and its `MIN_ROLE` row in
    `frontend/assets/js/utils/permissions/orgPermissions.js`, and the control each one gates
    through `useCan`:
    - `ACTIONS.RECONCILE` (`user`): the Reconcile / Continue reconciliation button, Edit
      statement, the checkboxes and bulk ticks, and Finish.
    - Cancel (`admin`): either a new `ACTIONS.CANCEL_RECONCILIATION`, or the existing `DELETE`
      action reused, since cancel is a DELETE. Pick one and state it.
    - `ACTIONS.UNDO_RECONCILIATION` (`admin`): the history Undo.
  - State that a hidden control is UX only and the backend 403 stays the enforcement, as
    `architecture/frontend.md` describes.
  - Mirror the "Hidden controls for `user`" list: a `user` sees Reconcile and Finish but not
    Cancel or Undo.
- `ui/ledger.md` § Statements history: make "allowed" explicit as
  `useCan(ACTIONS.UNDO_RECONCILIATION)`.
- Required tests:
  - `api/reconciliations.md`: list the role 403s per route (a `user` gets 403 on cancel and
    undo, under the org base path only).
  - `ui/reconcile.md` / `ui/ledger.md`: list the gating specs (Cancel and Undo hidden for
    `user`, shown for `admin` and `owner`).

## Files to Change

- `docs/agents/specs/reconciliation/api/reconciliations.md` — final Min role column, no provisional marker, role 403 tests
- `docs/agents/specs/reconciliation/security.md` — Roles moved from Open concerns to Decided
- `docs/agents/specs/reconciliation/ui/reconcile.md` — final action names, `MIN_ROLE` rows and gated controls
- `docs/agents/specs/reconciliation/ui/ledger.md` — Undo gated by the named action
