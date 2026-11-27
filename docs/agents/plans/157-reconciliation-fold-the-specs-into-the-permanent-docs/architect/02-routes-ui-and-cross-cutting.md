# Update the routes, UI and cross-cutting pages

Fold the API and UI specs, and the remaining cross-cutting mentions.

**`docs/agents/backend/routes/bank.md`**, under `<base>` = `/bank` and `/orgs/:orgId/bank`:

- `## Reconciliations`: the route table from `api/reconciliations.md` § Routes (history GET with
  `?page=N`, start POST, detail GET, edit, tick / untick, finish, cancel DELETE, undo), with
  bodies, success codes, errors, minimum role (`user` for everyday writes, `admin` for cancel and
  undo) and cache class. Then `### Reconciliation check order`,
  `### Reconciliation error codes` (the 409 table: `RECONCILIATION_OPEN`, `_FINISHED`,
  `_NOT_FINISHED`, `_NOT_LATEST`, `_OUT_OF_ORDER`, `_UNBALANCED`, `TRANSACTION_NOT_ELIGIBLE`,
  `TRANSACTION_CLEARED`, `ACCOUNT_RECONCILED`, reused `ACCOUNT_ARCHIVED`) and
  `### Reconciliation caching` (GETs `user-scoped`, writes `never`, owner-prefix invalidation, no
  per-account path invalidation, no Navi warm-up).
- `## Reconciliation locks on existing routes`: transaction PATCH / DELETE (`TRANSACTION_CLEARED`
  and its position in the check order), the `reconciliation` field on transaction responses and
  ledger rows, `last_reconciled_date` in the ledger envelope, the account detail fields,
  account PATCH (`ACCOUNT_RECONCILED`) and currency (`CURRENCY_LOCKED`), and the three payment
  undos.
- Add the new codes to the existing per-route error lists (Transactions, Accounts, Pay / skip /
  undo, the provider-bill error codes), add the new rows to § Minimum role, and add
  `last_reconciled_date` to § Ledger envelope and pagination and the two fields to § Account
  response.

**`docs/agents/modules/bank/ui.md`**: replace the partial § Reconciliation markers (and its
`(spec: ../../specs/reconciliation/ui/ledger.md)` link) with the full shipped UI from
`ui/reconcile.md` and `ui/ledger.md`: the entry point and role gating, the start / edit
statement form, reconcile mode (ticking, live difference bar, finish at 0, cancel), the
Statements history (paging, undo of the latest), the error messages, then the existing cleared
marker, locked fields, warning badge, header line and edit-form locks. Link
`reconciliation.md` instead of the spec.

**Cross-cutting pages**, updated only where they enumerate things reconciliation added:

- `docs/agents/architecture/backend.md` § Owned tables: add a `bank_reconciliations` row and
  extend the `bank_transactions` row with the nullable `reconciliation_id` FK.
- `docs/agents/architecture/frontend.md`: add the reconciliation client / components to the
  directory layout if bank components are enumerated there.
- `docs/agents/product.md` § `bank`: add a bullet for statement reconciliation (cleared rows and
  their lock), with epic #85 in the "Decided by" list.
- `docs/agents/architecture/caching.md` and `architecture/security.md`: change them only if they
  list bank routes or lock rules. Otherwise leave them alone.

## Files to Change
- `docs/agents/backend/routes/bank.md` — reconciliation routes, lock errors on existing routes (contract headings)
- `docs/agents/modules/bank/ui.md` — complete reconcile mode, history, markers, drop the spec link
- `docs/agents/architecture/backend.md` — owned tables
- `docs/agents/architecture/frontend.md` — only if the layout enumerates bank components
- `docs/agents/product.md` — `bank` summary bullet and epic reference
