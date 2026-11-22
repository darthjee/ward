# Consult the reviewers

Dispatch the three read-only reviewers **in parallel**, since their reviews are independent.
Give each one the spec files and the questions below. Collect their findings before editing
anything: Steps 02–04 apply them.

- **`product-owner`**:
  - Are the minimum roles (start, edit, tick and finish `user`; cancel and undo `admin`)
    consistent with `organizations.md` § Roles and `backend/routes/bank.md` § Minimum role?
  - Should finish stay `user`, given that it creates a lock no role can bypass?
  - Does the account list need `last_reconciliation` and `open_reconciliation_id`? No list
    UI in `ui/*.md` uses them today.
- **`data-access`**:
  - Is every reconciliation route (both base paths) scoped to accounts the caller can see,
    with a uniform 404 and no global `is_admin` bypass?
  - Does any response expose data outside that scope? Check the statement response, the
    history rows (`undoable`), the new ledger-row `reconciliation` field,
    `last_reconciled_date`, `last_reconciliation` and `open_reconciliation_id`.
  - Does a ticks body naming a foreign transaction id leak its existence? The spec answers
    404 and rejects the whole batch.
- **`security`**:
  - Review the new routes and every new 409 path.
  - Bulk-tick validation: at most 50 ids, disjoint, at least one non-empty, ids validated
    like `parseId`, duplicates inside one array.
  - Statement date bounds: `opening_date`, "today" versus "today + 1 day", and the
    ordering rule.
  - Statement balance bounds: the sign, absolute value or not, and decimal-string parsing.
  - Check order, including where the role 403 falls.
  - Concurrency: one open statement per account (`open_key` unique plus `FOR UPDATE`), with
    concurrent start, tick vs. transaction PATCH or DELETE, finish vs. tick, and undo vs.
    start.
  - Body logging and other financial-data sensitivity.

Pass the context gathered in `plan.md` § Context (the inconsistencies found) to all three.

## Files to Change

- None. This step only gathers input. Files to give the reviewers:
  - `docs/agents/specs/reconciliation/security.md`
  - `docs/agents/specs/reconciliation/api/reconciliations.md`
  - `docs/agents/specs/reconciliation/api/existing-routes.md`
  - `docs/agents/specs/reconciliation/ui/reconcile.md`
  - `docs/agents/specs/reconciliation/ui/ledger.md`
  - `docs/agents/specs/reconciliation/model.md`
  - `docs/agents/modules/auth/organizations.md`
  - `docs/agents/backend/routes/bank.md`
