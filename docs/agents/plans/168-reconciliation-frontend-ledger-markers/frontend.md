# Frontend Plan: Reconciliation — frontend: ledger markers

Main plan: [plan.md](plan.md)

## Overview
Render the reconciliation state that the backend already returns (#165, #166):

- the cleared marker and the warning badge on ledger rows;
- the locked `amount` / `date` fields on cleared rows, and the hidden Delete action;
- the "Last reconciled" header line;
- read-only opening fields (and a locked currency) on the account edit form.

Everything goes through the shared `bank/common/` code, so accounts, debts, investments and
providers all get it.

## Context
Source of truth: `docs/agents/specs/reconciliation/ui/ledger.md` (§ Cleared marker, § Locked
fields, § Warning badge, § Header line, § Required tests: Cleared marker, Locked fields,
Warning badge, Header line, Account edit form) and `api/existing-routes.md`. The History, History
Undo and Error messages bullets belong to #167 (merged) and are not part of this plan.

Data the frontend already receives (no backend change needed):

- **Ledger row** `reconciliation`: `null` or `{ id, status: 'open' | 'finished', statement_date }`.
  `B/reconciliation/controllers/eligibility.js` already reads it. The virtual opening row never
  carries it.
- **Ledger envelope** `last_reconciled_date`: a `YYYY-MM-DD` string or `null`. It reaches
  `LedgerTableHelper` untouched as `state.ledger`, but nothing reads it yet.
- **Account detail** (not the list):
  - `last_reconciliation`: `{ statement_date, statement_balance, reconciled_at } | null`;
  - `open_reconciliation_id`: `number | null`.

  `BankAccountLoader` loads it for both the detail page and the edit page.

Shorthand: `B/` = `frontend/assets/js/components/resources/bank/common/`, `S/` =
`frontend/specs/assets/js/components/resources/bank/common/`.

Decisions taken for this plan:

- **Where the markers go.** They render inside the description `<td>` of
  `LedgerTableHelper.renderRow`, before `renderRowExtra`. This follows the issue rather than
  the spec's "`renderRowExtra` or a dedicated cell", because providers already use
  `renderRowExtra` and the marker must appear for all four types.
- **Shared predicate.** `isCleared(row)` = `row.reconciliation?.status === 'finished'`. It goes
  in `B/reconciliation/controllers/eligibility.js`, next to `isEligible` / `isTicked`, and every
  step uses it.
- **Warning rule.** The badge shows when
  `!row.reconciliation && last_reconciled_date && row.date <= last_reconciled_date`, comparing
  the `YYYY-MM-DD` strings.
- **Tooltip.** A plain `title` attribute. The codebase has no tooltip component.
- **Styling.** Bootstrap badge classes only, with no new CSS and no i18n. Strings are exported
  constants.
- **Direction toggle.** The Out / In toggle is locked along with `amount` on a cleared row,
  because it flips the amount's sign.
- **Where the markers show.** They show in reconcile mode and on archived (read-only) accounts
  as well. The spec does not restrict them.

## Steps

- [01 — Ledger row markers and hidden Delete](frontend/01-ledger-row-markers.md)
- [02 — Locked fields in the ledger form](frontend/02-ledger-form-locks.md)
- [03 — Last reconciled header line](frontend/03-header-line.md)
- [04 — Account edit form locks](frontend/04-account-edit-form-locks.md)
- [05 — Docs (architect)](frontend/05-docs.md)

## CI Checks
- `frontend`: `docker-compose run --rm ward_fe yarn test` (CI job: frontend tests via `yarn_project`)
- `frontend`: `docker-compose run --rm ward_fe yarn lint` (CI job: frontend lint via `yarn_project`)

## Notes
- **Debt sign.** The existing `Balance:` header line is not negated for debts today. The spec
  asks for the "Last reconciled" balance to be negated, so on a debt the two lines next to each
  other show opposite signs. Follow the spec, and flag this in the PR.
- **File sizes.** `AccountDetailHelper.jsx` is at 266 lines and `LedgerTableHelper.jsx` at 209,
  against a 300 limit. Put the new rendering in small components, and keep the helpers thin.
- **Rows on an open statement.** These have `status: 'open'`. They get no marker and no lock.
  They get no warning badge either, because `reconciliation !== null`. This matches the spec.
- **The server stays the backstop.** Its 409 answers (`TRANSACTION_CLEARED`,
  `ACCOUNT_RECONCILED`, `CURRENCY_LOCKED`) still go through `classifyError` (#167).
