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
| Balances | Still computed; no per-statement opening balance stored (checkpoint anchors rejected) |
| Mismatch surfacing | The difference bar and the warning badge only: no list badge, no notifications |

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
- **Checkpoint anchors** (each finished statement becomes a new balance anchor): rejected. It
  would add a second source of truth for balances that could drift from the ledger, undo would
  have to re-anchor instead of reverting the latest statement, and the cleared-row locks already
  protect the history. See [security.md](security.md#decided).

## Index

- [model.md](model.md) — entity, `Transaction` change, states, formulas, queries and indexes, lifecycle, lock matrix, migration and backward compatibility
- [api/reconciliations.md](api/reconciliations.md) — the new reconciliation routes, payloads, error codes, cache classes and invalidation
- [api/existing-routes.md](api/existing-routes.md) — changes to transaction, ledger, account and bill-payment routes, and their cache classes
- [ui/reconcile.md](ui/reconcile.md) — entry point, start form, reconcile mode, client
- [ui/ledger.md](ui/ledger.md) — cleared marker, locked fields, warning badge, header line, history, errors
- [security.md](security.md) — roles, ownership, response fields, sensitivity, bounds, concurrency, migration, performance, cache, memory, mismatch surfacing and checkpoint anchors

## Delivery

The epic follows four phases:

1. **Initial specs** — this folder ([#152](https://github.com/darthjee/ward/issues/152)).
2. **Spec enhancement** — complete. Roles, security and data access were settled by
   [#153](https://github.com/darthjee/ward/issues/153), migration, performance, memory and
   caching by [#154](https://github.com/darthjee/ward/issues/154), and mismatch surfacing,
   checkpoint anchors and testing by [#155](https://github.com/darthjee/ward/issues/155). The
   specs are ready for phase 3.
3. **Create the implementation issues** — complete
   ([#156](https://github.com/darthjee/ward/issues/156)). It created the five implementation sub-issues
   [#164](https://github.com/darthjee/ward/issues/164), [#165](https://github.com/darthjee/ward/issues/165), [#166](https://github.com/darthjee/ward/issues/166), [#167](https://github.com/darthjee/ward/issues/167) and
   [#168](https://github.com/darthjee/ward/issues/168). The fold is [#157](https://github.com/darthjee/ward/issues/157).
4. **Fold** — fold the specs into the permanent docs and remove this folder.

### Sub-issue → file map

Phase 3 ([#156](https://github.com/darthjee/ward/issues/156)) created the implementation sub-issues. Each one reads only the files
listed, and each stands alone.

| Sub-issue | Reads | Depends on |
|---|---|---|
| [#164](https://github.com/darthjee/ward/issues/164) — backend migration and entity | `model.md`, `security.md` | — |
| [#165](https://github.com/darthjee/ward/issues/165) — backend reconciliation API (and the lifecycle e2e spec) | `model.md`, `api/reconciliations.md`, `security.md` | #164 |
| [#166](https://github.com/darthjee/ward/issues/166) — backend locks on existing routes | `model.md`, `api/existing-routes.md` | #164 |
| [#167](https://github.com/darthjee/ward/issues/167) — frontend reconcile mode and Statements history | `api/reconciliations.md`, `api/existing-routes.md`, `ui/reconcile.md`, `ui/ledger.md` (§ Statements history and § Errors) | #165 |
| [#168](https://github.com/darthjee/ward/issues/168) — frontend ledger markers | `api/existing-routes.md`, `ui/ledger.md` (§ Cleared marker, § Locked fields, § Warning badge and § Header line) | #166 |
| [#157](https://github.com/darthjee/ward/issues/157) — fold into the permanent docs | all files, § Future epics | #164 to #168 |

The order is: #164, then #165 and #166 in parallel, then #167 (after #165) and #168 (after
#166), then #157. All backend issues come before the frontend ones. `ui/ledger.md` is split
between #167 (history, undo and errors) and #168 (markers, locks, badge, header line and account
edit form), so the two never claim the same test.

No cache/Navi issue was created: Navi warms nothing for this feature, because every new GET is
user-scoped, and `navi/navi_config.yaml` needs no change. The `security` and `cache` reviews
belong to #165 and #166, which add or change endpoints.

## Open concerns

None remain. Everything is settled in [security.md](security.md#decided).

## Testing overview

Each area's tests are the **Required tests** of the file named below. The existing
`accountant.e2e-spec.ts` and the bill-payment specs must stay green and unchanged. The backend
also gets a dedicated end-to-end lifecycle spec,
`backend/src/bank/tests/reconciliation-lifecycle.e2e-spec.ts`, run under both the `/bank` and
`/orgs/<id>/bank` base paths. The frontend uses Jasmine specs only
([ui/reconcile.md](ui/reconcile.md#required-tests), [ui/ledger.md](ui/ledger.md#required-tests)),
with no end-to-end tooling.

| Implementation area | Required tests in |
|---|---|
| Migration and entity | [model.md](model.md#required-tests) |
| Reconciliation API | [api/reconciliations.md](api/reconciliations.md#required-tests) |
| End-to-end lifecycle (both base paths) | [api/reconciliations.md](api/reconciliations.md#required-tests) |
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
