# Reconciliation — Reconcile mode UI

Part of the [Reconciliation spec](../README.md). This file defines the entry point, the start
form, reconcile mode and the client methods. Everything lands in the shared `bank/common` detail
(`frontend/assets/js/components/resources/bank/common/`, written `B/` below), so all four account
types get it without per-type copies.

## Entry point

A **Reconcile** button in the `B/detail/helpers/AccountHeaderHelper.jsx` actions row, next to
Edit and Archive. It is a private `renderReconcileButton` that returns null when the account is
archived or the user is not allowed (`useCan(ACTIONS.WRITE)`). It reads **Continue
reconciliation** when `open_reconciliation_id` (from the account detail) is set.

## Role gating

Controls are gated through `useCan` and `ACTIONS` in
`frontend/assets/js/utils/permissions/orgPermissions.js`, matching the backend `@MinOrgRole` of
[api/reconciliations.md](../api/reconciliations.md#routes). Only one action is new:

| Control | Action | Min role |
|---|---|---|
| Reconcile / Continue reconciliation, Edit statement, the checkboxes and bulk ticks, Finish | `ACTIONS.WRITE` (existing) | `user` |
| Cancel | `ACTIONS.DELETE` (existing, since cancel is a DELETE route) | `admin` |
| History Undo (see [ui/ledger.md](ledger.md#statements-history)) | `ACTIONS.UNDO_RECONCILIATION` (new `MIN_ROLE` row) | `admin` |

A hidden control is UX only: the backend 403 stays the enforcement, as
[Frontend architecture](https://github.com/darthjee/ward/blob/main/docs/agents/architecture/frontend.md)
describes. **Hidden controls for `user`**: a `user` sees Reconcile, the checkboxes and Finish, but
not Cancel or Undo. `admin` and `owner` (and the personal context) see everything.

## Start and edit statement form

- **Statement date** defaults to today, with `max` today like the ledger form. That `max` is a UX
  default only: the server accepts up to UTC today + 1 day (see
  [security.md](../security.md#input-bounds)).
- **Statement balance** uses `B/form/AccountFormInput.jsx` with `inputMode: 'decimal'`, parsed
  with `B/amounts.js` `parseAmount`.
- On a debt the balance is labelled "Amount owed" and negated with `negateAmount` on load and on
  submit, the same as `debts/pages/controllers/debtFormFields.js`.

## Reconcile mode

It is on the same detail page, rendered through the `renderAfterHeader` slot of
`B/detail/helpers/AccountDetailHelper.jsx`:

- a sticky **summary bar** showing statement date, statement balance, cleared balance and
  **Difference** (highlighted unless 0), with the actions **Finish** (enabled only at 0),
  **Edit statement** and **Cancel** (Cancel opens `B/ConfirmModal.jsx`);
- a **checkbox column** in `B/detail/helpers/LedgerTableHelper.jsx`, enabled only on eligible rows
  (on or after `opening_date`, on or before `statement_date`, not cleared by an earlier
  statement). Ineligible rows are dimmed, and the opening row has no checkbox;
- **Show only uncleared**, a local filter on the loaded page, independent of
  [#90](https://github.com/darthjee/ward/issues/90);
- **Tick all on page / Untick all**, one call to the bulk ticks route;
- **Optimistic toggle**: flip the checkbox, call `PATCH …/ticks.json`, take the difference from
  the response, and revert on error;
- the inline transaction form stays usable, so a new transaction can be added and then ticked.

## Client

New methods in `frontend/assets/js/client/BankClient.js` (or a new `ReconciliationsClient.js`
spread into it, like `TypedAccountsClient.js`): `listReconciliations`, `startReconciliation`,
`getReconciliation`, `updateReconciliation`, `cancelReconciliation`, `tickTransactions`,
`finishReconciliation` and `undoReconciliation`. Each body is whitelisted. The routes are in
[api/reconciliations.md](../api/reconciliations.md).

## Reference

- [Epic #85](https://github.com/darthjee/ward/issues/85)
- [Bank — UI](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/ui.md)
- [`AccountHeaderHelper.jsx`](https://github.com/darthjee/ward/blob/main/frontend/assets/js/components/resources/bank/common/detail/helpers/AccountHeaderHelper.jsx)
- [`AccountDetailHelper.jsx`](https://github.com/darthjee/ward/blob/main/frontend/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx)
- [`LedgerTableHelper.jsx`](https://github.com/darthjee/ward/blob/main/frontend/assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelper.jsx)

## Required tests

Jasmine specs mirroring the source paths under `frontend/specs/assets/js/...`:

- header button states (archived, role, open statement);
- role gating: Cancel hidden for `user` and shown for `admin` and `owner`, while Reconcile and
  Finish show for `user`;
- the debt negation of the statement balance;
- the optimistic tick and its revert on error;
- Finish disabled unless the difference is 0.

Back to the [README](../README.md).
