# Settle data access and the account payload

Apply the `data-access` (and `product-owner`) findings.

- `security.md` § Decided, **Ownership** row: confirm (or tighten) the uniform-404 rule for
  every reconciliation route under both base paths. Spell out these cases:
  - a statement id that belongs to another account of the same owner answers 404, not 409;
  - a non-member, a wrong context, or global `is_admin` answers 404;
  - a ticks body with a foreign transaction id answers 404 and rejects the whole batch,
    without revealing which id failed.
- Add a **Response fields** row (or a short subsection) to `security.md` § Decided. List every
  new field and why it stays inside the caller's scope:
  - the statement response;
  - the history row with `undoable`;
  - the ledger-row `reconciliation` (`{ id, status, statement_date }`);
  - the ledger envelope's `last_reconciled_date`;
  - the account `last_reconciliation` and `open_reconciliation_id`.

  None carries owner, user or member fields, and none points to another account's statement.
- **Account list payload**: decide whether `last_reconciliation` and `open_reconciliation_id`
  are on the list or only on the account detail. The recommended default is **detail only**:
  no list UI in `ui/*.md` reads them, and it avoids an extra grouped query on the list. Use
  the reviewers' answer if it differs. Then:
  - remove the "Account list payload" bullet from `security.md` § Open concerns and record
    the decision in § Decided;
  - update `api/existing-routes.md` § Accounts: drop "(detail and list)" and the grouped-query
    sentence if the decision is detail only, and remove the provisional sentence;
  - check that `ui/ledger.md` § Header line and `ui/reconcile.md` § Entry point read the fields
    from the account detail only.
- Required tests in `security.md` / `api/existing-routes.md`:
  - the account list does **not** carry the fields (if the decision is detail only);
  - a foreign statement id under an owned account answers 404.

## Files to Change

- `docs/agents/specs/reconciliation/security.md` — Ownership row tightened, Response fields row, Account list payload decided
- `docs/agents/specs/reconciliation/api/existing-routes.md` — § Accounts updated to the decision, provisional sentence removed
- `docs/agents/specs/reconciliation/ui/ledger.md` — header line source confirmed (only if wording changes)
- `docs/agents/specs/reconciliation/ui/reconcile.md` — entry point source confirmed (only if wording changes)
