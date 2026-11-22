# Spec folder README and hub registration

Create `docs/agents/specs/reconciliation/README.md` and register the spec in the hub.

The README must contain:

- **Header** — "Feature spec for epic [#85 — Reconciliation](https://github.com/darthjee/ward/issues/85)" and a link to the
  [Feature Specs](https://github.com/darthjee/ward/blob/main/docs/agents/specs.md) hub for the lifecycle.
- **Overview** — the problem: the opening anchor silently absorbs a wrongly backfilled
  transaction, and nothing protects rows that were already checked against the bank. Then the
  solution: a statement checkpoint, ticking, a live difference, and finishing at 0, which
  clears and locks the ticked rows.
- **Product decision table**:

  | Decision | Choice |
  |---|---|
  | Shape | Flag plus statement checkpoint (not flag only, not import) |
  | Tick storage | Nullable `reconciliation_id` FK on `bank_transactions` |
  | States | `open` → `finished`, and undo returns to `open` |
  | Lock | `amount` / `date` / delete of rows cleared into a finished statement |
  | Lock bypass | None, `admin` included |
  | Opening anchor | Locked once any statement is finished |
  | Ordering | Statements are chronological; only the latest finished one can be undone |
  | Balances | Still computed; no per-statement opening balance stored |

- **Scope and out of scope**, copied from the issue: statement import, cross-account / linked
  transfer reconciliation (#86), currency conversion (#88), auto-creating missing
  transactions, and drilling from history to the filtered ledger.
- **Alternatives considered** — flag only, flag plus import, full lock, soft lock, each with
  the reason the issue gives for rejecting it.
- **Index** linking `model.md`, `api/reconciliations.md`, `api/existing-routes.md`,
  `ui/reconcile.md`, `ui/ledger.md` and `security.md`.
- **Delivery** — the epic's four phases: 1 initial specs (this issue), 2 spec enhancement
  issue(s), 3 create the implementation issues, 4 fold into the permanent docs. Add a
  **Sub-issue → file map** table whose rows are TBD, to be filled in phase 3. Suggest a likely
  split for phase 3 to confirm:
  1. backend migration plus entity;
  2. backend reconciliation API;
  3. backend locks on existing routes;
  4. frontend reconcile mode plus history;
  5. frontend ledger markers;
  6. fold.
- **Open concerns** — a list pointing to `security.md#open-concerns` (written in step 06).
- **Future epics** — statement import (OFX/CSV upload, automatic matching), drilling from a
  statement to the ledger filtered to its rows, and a statement audit log. For each, say what
  it covers and which spec file it comes from.
- **Reference** — the epic, the specs hub, and the permanent docs it will change, as GitHub
  URLs: `modules/bank/transactions.md`, `modules/bank/accounts.md`, `modules/bank/bills.md`,
  `modules/bank/ui.md`, `backend/routes/bank.md`.
- **Required tests** — a pointer to each file's own Required tests section.

In `docs/agents/specs.md`, replace the `none` row under **Active specs** with
`| Reconciliation (statement checkpoints, cleared transactions and their lock) | [specs/reconciliation/](specs/reconciliation/README.md) | [#85](https://github.com/darthjee/ward/issues/85) |`.

## Files to Change
- `docs/agents/specs/reconciliation/README.md` — new; the spec's entry point and index.
- `docs/agents/specs.md` — add the Active specs row.
