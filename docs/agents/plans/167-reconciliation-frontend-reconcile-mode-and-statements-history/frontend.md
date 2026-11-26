# Plan: Reconciliation: frontend reconcile mode and statements history

Issue: [167-reconciliation-frontend-reconcile-mode-and-statements-history.md](../../issues/167-reconciliation-frontend-reconcile-mode-and-statements-history.md)

## Overview

Add the reconcile workflow to the shared detail page under
`frontend/assets/js/components/resources/bank/common/` (written `B/` below). New code goes in a
new `B/reconciliation/` folder that uses the same layout as `B/bills/`: components at the root,
plus `controllers/`, `helpers/` and `hooks/`. `AccountDetailHelper`, `AccountHeaderHelper` and
`LedgerTableHelper` only get small hooks into it, because they are close to the 300-line
`max-lines` limit.

## Context

The sources of truth are `docs/agents/specs/reconciliation/ui/reconcile.md` (all of it),
`ui/ledger.md` (only § Statements history and § Errors) and `api/reconciliations.md`. #168 owns
the cleared marker, locked fields, warning badge, "Last reconciled" header line and the account
edit form lock. This plan does not touch those.

Current state, as explored:

- **Clients.** `BankClient.js` spreads `TypedAccountsClient`. Paths are built with
  `contextPath(context, ...)` and `accountPath(context, id, suffix)`. Bodies go through
  `whitelist(attrs, FIELDS)` from `client/accountBodies.js`. `BankClientSpec.js` runs over a
  `CONTEXTS` list (personal `''` and org `/orgs/5`) and uses `fetchSequence`.
- **Permissions.** `utils/permissions/orgPermissions.js` has frozen `ACTIONS` and a private
  `MIN_ROLE` Map. `useCan` is in `components/common/ownerContext/hooks/useCan.js`.
  `orgPermissionsSpec.js` has a `MATRIX` that must cover every action. Detail helpers never call
  `useCan`: `B/detail/hooks/useAccountDetail.js` passes `can*` flags in `state`. Self-contained
  components such as `B/bills/BillHistory.jsx` call `useCan` themselves.
- **Detail page.** All four section pages call `useAccountDetail(BASE)` and then their section
  helper, which calls `AccountDetailHelper.render(state, handlers, options)`. The
  `renderAfterHeader` slot is already used by Providers (`ProviderBills`), and
  `renderAfterLedger` is used by Debts (`BillHistory`). Reconcile mode and the history must
  therefore be rendered by `AccountDetailHelper` itself, not through the section slots. `reload`
  (from `useAccountLedger`) refreshes the account and the ledger page together.
- **Bill history stack**, to mirror: `BillHistory.jsx`, `hooks/useBillHistory.js`
  (`buildBillHistoryHandlers`), `controllers/BillHistoryController.js` (`EMPTY_HISTORY`,
  constructor DI, `runLoad`), `helpers/BillHistoryHelper.jsx`, `UndoPaymentConfirm.jsx`,
  `B/BankPagination.jsx` and `B/ConfirmModal.jsx`.
- **Errors.** `B/bankErrors.js` `classifyError` only branches on status. There is no central
  code map. The closest pattern is `ERROR_PLACEMENTS` and `placeError` in
  `bank/bills/pages/controllers/BillFormController.js`.
- **Amounts and forms.** `B/amounts.js` provides `parseAmount` (with
  `{currency, allowNegative, allowZero}`), `negateAmount`, `formatMoney` and `isZeroAmount`.
  Debts negate on load and submit in `debts/pages/controllers/debtFormFields.js`.
  `B/form/AccountFormInput.jsx` is the input. `B/dates.js` provides `localToday()`. A debt is
  `account.type === 'debt'`.

## Shared design decisions

- **Mode state.** Reconcile mode is local page state owned by a new `useReconcile` hook, which
  `useAccountDetail` calls. Its `state.reconcile` is `{ mode: 'off' | 'form' | 'active',
  statement, formKind: 'start' | 'edit', fields, fieldErrors, ticked: Map<id, boolean>,
  onlyUncleared, pending, error, historyVersion, canWrite, canCancel }`. Its handlers go under
  `handlers.reconcile`. The page does not enter reconcile mode on load.
  - With no open statement, **Reconcile** opens the start form.
  - With `open_reconciliation_id` set, **Continue reconciliation** fetches it with
    `getReconciliation` and goes to `active`.
- **Ticked state of a row.** `ticked.get(row.id)` if present, otherwise
  `row.reconciliation?.id === statement.id`. The `ticked` overlay is cleared every time the
  ledger reloads.
- **Eligibility.** A row is eligible if it is not the opening row, `row.date >=
  account.opening_date`, `row.date <= statement.statement_date`, and `row.reconciliation` is
  null or has `id === statement.id`. This is a pure function in
  `B/reconciliation/controllers/eligibility.js`.
- **Refresh.** Every successful write replaces `statement` with the response, which also gives
  the live difference. Finish, cancel and undo also call `reload()` (account and ledger) and bump
  `historyVersion`. `StatementsHistory` takes `historyVersion` as a prop and reloads when it
  changes. Its Undo calls back into `reload()` through `onUndone`.
- **Errors.** `B/reconciliation/controllers/reconciliationErrors.js` exports
  `RECONCILIATION_MESSAGES` (a `Map` of the 8 codes to fixed text) and
  `classifyReconciliationError(error)`. It calls `classifyError` and replaces
  `message`/`messages` when the code is mapped. Otherwise it keeps the server message. Every
  reconciliation controller uses it, and the result renders through `BankErrorAlert`.

## Steps

- [01 — Reconciliations client](frontend/01-reconciliations-client.md)
- [02 — Permission and error messages](frontend/02-permission-and-error-messages.md)
- [03 — Statement form (start and edit)](frontend/03-statement-form.md)
- [04 — Reconcile controller and hook](frontend/04-reconcile-controller-and-hook.md)
- [05 — Reconcile mode UI: header button, summary bar, checkbox column](frontend/05-reconcile-mode-ui.md)
- [06 — Statements history with Undo](frontend/06-statements-history.md)

## CI Checks

- `frontend`: `docker-compose run --rm ward_fe yarn test` (CI job: `jasmine`, which runs `yarn coverage`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- **Conflicts with #168.** It edits `AccountHeaderHelper.jsx`, `LedgerTableHelper.jsx` and
  `AccountDetailHelper.jsx` at the same time. Keep the edits here small and in clearly separated
  private functions.
- **Leaving reconcile mode.** The spec only defines Finish and Cancel as ways out. A plain
  "Close" that leaves the statement open is not specified, so this plan does not add one.
  Navigating away also leaves the statement open, and **Continue reconciliation** resumes it.
- **Ticks payload.** The statement response does not list the ticked ids. The checkbox state comes
  from the ledger rows' `reconciliation` field (#166) plus the local `ticked` overlay.
- **Statement balance.** It may be negative or zero, so parse it with `parseAmount(input,
  {currency, allowNegative: true, allowZero: true})`.
- **Placement of the history.** The history is rendered after the `renderAfterLedger` slot, so on
  debts it comes after Bill history.
- **Role gating in specs.** Wrap components in `OwnerContext.Provider` with
  `{...DEFAULT_OWNER_CONTEXT, role}` (as `BillHistorySpec` does). `roleGatedPageExamples.js` is
  for admin-only pages and does not fit inline controls.
- **Lint limits.** jsdoc is required on all asset code. Use `Map` lookups and `readField` instead
  of bracket access (`security/detect-object-injection`).
