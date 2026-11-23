# Reconciliation — Statement checkpoints

Feature spec for epic [#85 — Reconciliation](https://github.com/darthjee/ward/issues/85).
This folder is the source of truth for the epic's sub-issues; see
[Feature Specs](https://github.com/darthjee/ward/blob/main/docs/agents/specs.md) for the lifecycle.

## Overview

The opening balance of an account is an anchor, so backfilling never changes balances from the
anchor onward. The known trade-off: a wrongly backfilled transaction is **silently absorbed**
into the history before the anchor instead of surfacing as a mismatch against the bank statement.
Ward also has no way to record that the ledger agreed with the bank at a given date, so nothing
protects rows that were already checked from later edits or deletes.

The epic adds a **statement checkpoint** per account (statement date and statement balance). The
user ticks the ledger rows that appear on the bank statement, and Ward shows the **difference**
live. Finishing is allowed only at difference 0. It marks the ticked rows as **cleared**, and
cleared rows have `amount` and `date` locked and cannot be deleted. The latest finished
statement can be undone.

## Product decision

| Decision | Choice |
|---|---|
| Shape | Flag plus statement checkpoint (not flag only, not import) |
| Tick storage | Nullable `reconciliation_id` FK on `bank_transactions` |
| States | `open` → `finished`, and undo returns to `open` |
| Lock | `amount` / `date` / delete of rows cleared into a finished statement |
| Lock bypass | None, `admin` included |
| Opening anchor | Locked once any statement exists, open or finished |
| Ordering | Statements are chronological; only the latest finished one can be undone |
| Balances | Still computed; no per-statement opening balance stored |

Balances stay computed from the ledger and the opening anchor, as in
[Transactions — Balance](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/transactions.md#balance).

## Scope and out of scope

In scope: a per-transaction cleared marker (`reconciliationId`), a per-account statement
checkpoint record, the reconcile workflow with a live difference, the lock rules, undo, history,
and the UI on the shared `bank/common` detail page, for all four account types.

Out of scope for this epic:

- statement import (OFX/CSV upload, automatic matching);
- cross-account / linked-transfer reconciliation
  ([#86](https://github.com/darthjee/ward/issues/86));
- currency conversion ([#88](https://github.com/darthjee/ward/issues/88));
- auto-creating missing transactions from the statement;
- drilling from the statements history to a ledger filtered to its rows.

## Alternatives considered

- **Flag only** (cleared flag and cleared balance, compared by eye): rejected. Ward never knows
  the statement balance, so it cannot surface a mismatch itself.
- **Flag plus statement plus import**: rejected for this epic. Parsers, fuzzy matching and an
  upload surface are a much larger, separate concern.
- **Full lock** (no edit at all on a cleared row): rejected. It blocks harmless typo fixes in
  description and notes.
- **Soft lock** (edit allowed, the row is un-cleared and the statement flagged broken): rejected.
  It reintroduces the silent drift this epic exists to remove.

## Index

- [model.md](model.md) — entity, `Transaction` change, states, formulas, queries and indexes, lifecycle, lock matrix, migration and backward compatibility
- [api/reconciliations.md](api/reconciliations.md) — the new reconciliation routes, payloads, error codes, cache classes and invalidation
- [api/existing-routes.md](api/existing-routes.md) — changes to transaction, ledger, account and bill-payment routes, and their cache classes
- [ui/reconcile.md](ui/reconcile.md) — entry point, start form, reconcile mode, client
- [ui/ledger.md](ui/ledger.md) — cleared marker, locked fields, warning badge, header line, history, errors
- [security.md](security.md) — roles, ownership, response fields, sensitivity, bounds, concurrency, migration, performance, cache, memory, open concerns

## Delivery

The epic follows four phases:

1. **Initial specs** — this folder ([#152](https://github.com/darthjee/ward/issues/152)).
2. **Spec enhancement** — one or more issues refining the specs and settling the
   [open concerns](security.md#open-concerns). Roles, security and data access were settled by
   [#153](https://github.com/darthjee/ward/issues/153), and migration, performance, memory and
   caching by [#154](https://github.com/darthjee/ward/issues/154). Only mismatch surfacing,
   checkpoint anchors and testing remain for
   [#155](https://github.com/darthjee/ward/issues/155).
3. **Create the implementation issues** — an issue that breaks the finished specs into
   implementation sub-issues.
4. **Fold** — fold the specs into the permanent docs and remove this folder.

### Sub-issue → file map

The implementation sub-issues do not exist yet; phase 3 creates them. The rows are TBD.

| Sub-issue | Reads |
|---|---|
| TBD — backend migration plus entity | TBD (likely `model.md`, `security.md`) |
| TBD — backend reconciliation API | TBD (likely `model.md`, `api/reconciliations.md`, `security.md`) |
| TBD — backend locks on existing routes | TBD (likely `model.md`, `api/existing-routes.md`) |
| TBD — frontend reconcile mode plus history | TBD (likely `api/*.md`, `ui/reconcile.md`, `ui/ledger.md`) |
| TBD — frontend ledger markers | TBD (likely `api/existing-routes.md`, `ui/ledger.md`) |
| TBD — fold into the permanent docs | all files, § Future epics |

The likely split suggested for phase 3 to confirm:

1. backend migration plus entity;
2. backend reconciliation API;
3. backend locks on existing routes;
4. frontend reconcile mode plus history;
5. frontend ledger markers;
6. fold.

## Open concerns

Roles, security, data access, migration, performance, memory and caching are settled (see
[security.md](security.md#decided)). What remains, each with a provisional default, is in
[security.md](security.md#open-concerns): mismatch surfacing and checkpoint anchors as an
alternative ([#155](https://github.com/darthjee/ward/issues/155)).

## Testing overview

Each area's tests are the **Required tests** of the file named below. The existing
`accountant.e2e-spec.ts` and the bill-payment specs must stay green and unchanged.

| Implementation area | Required tests in |
|---|---|
| Migration and entity | [model.md](model.md#required-tests) |
| Reconciliation API | [api/reconciliations.md](api/reconciliations.md#required-tests) |
| Locks on existing routes | [api/existing-routes.md](api/existing-routes.md#required-tests) |
| Frontend reconcile mode | [ui/reconcile.md](ui/reconcile.md#required-tests) |
| Frontend ledger and history | [ui/ledger.md](ui/ledger.md#required-tests) |
| Ownership, bounds, cache and invalidation | [security.md](security.md#required-tests) |

## Future epics

Each becomes a GitHub epic at fold time, and its URL is recorded where the lasting docs mention
it. None is opened now.

- **Statement import** — upload an OFX or CSV statement and match its lines to ledger rows
  automatically, instead of ticking by hand. Must keep the tick and finish rules, the lock, and
  the difference. From the out-of-scope list and [model.md](model.md).
- **Statement-to-ledger drill-down** — open the ledger filtered to the rows of one statement from
  the history. Must be written against the ledger filters of
  [#90](https://github.com/darthjee/ward/issues/90). From [ui/ledger.md](ui/ledger.md).
- **Statement audit log** — record who started, ticked, finished, undid and cancelled a
  statement. Overlaps the audit trail of
  [#95](https://github.com/darthjee/ward/issues/95). From [security.md](security.md).

## Reference

- [Epic #85](https://github.com/darthjee/ward/issues/85)
- [Feature Specs](https://github.com/darthjee/ward/blob/main/docs/agents/specs.md)
- [Bank — Transactions](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/transactions.md)
- [Bank — Accounts](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/accounts.md)
- [Bank — Bills](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/bills.md)
- [Bank — UI](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/ui.md)
- [Routes — Bank](https://github.com/darthjee/ward/blob/main/docs/agents/backend/routes/bank.md)

## Required tests

Each file in this folder ends with its own Required tests section. See the
[testing overview](#testing-overview) above.
