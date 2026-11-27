# Bank — Reconciliation

Statement checkpoints, cleared transactions and their lock, for every account type of the
[bank module](../bank.md). Epic [#85](https://github.com/darthjee/ward/issues/85), built by #164
to #168 and folded into these docs by #157.

The routes are in [Routes — Bank](../../backend/routes/bank.md#reconciliations) and the UI is in
[Bank — UI](ui.md#reconciliation). This page holds the model and the rules behind them.

## Overview

The opening balance of an account is an anchor, so backfilling never changes balances from the
anchor onward. The known trade-off: a wrongly backfilled transaction is **silently absorbed**
into the history before the anchor instead of surfacing as a mismatch against the bank statement.
Ward also needs a way to record that the ledger agreed with the bank at a given date, so rows
that were already checked are protected from later edits or deletes.

Each account has **statement checkpoints** (statement date and statement balance). The user ticks
the ledger rows that appear on the bank statement, and Ward shows the **difference** live.
Finishing is allowed only at difference 0. It marks the ticked rows as **cleared**, and cleared
rows have `amount` and `date` locked and cannot be deleted. The latest finished statement can be
undone.

Balances stay computed from the ledger and the opening anchor, as in
[Transactions — Balance](transactions.md#balance).

## Product decisions

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
| Mismatch surfacing | See [Mismatch surfacing](#mismatch-surfacing) |

**In scope:** a per-transaction cleared marker (`reconciliationId`), a per-account statement
record, the reconcile workflow with a live difference, the lock rules, undo, history, and the UI
on the shared `bank/common` detail page, for all four account types.

**Out of scope:** statement import, cross-account / linked-transfer reconciliation, currency
conversion, auto-creating missing transactions from the statement, and drilling from the history
to a filtered ledger. See [Deferred](#deferred).

## Reconciliation entity

Table `bank_reconciliations`, entity file `backend/src/bank/entities/reconciliation.entity.ts`.
It follows the plain-column style of the `BillPayment` entity (`bill-payment.entity.ts`): no
TypeORM relations, and the real FKs are declared in the migration.

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `accountId` | int, FK `bank_accounts.id` `ON DELETE CASCADE` | Inherits the owner through the account and never stores one. The cascade lets an account with no transactions but with a zero-row statement still be hard-deleted |
| `statementDate` | `DATE` | At least `openingDate`, at most UTC today + 1 day, strictly after the latest finished statement's date |
| `statementBalance` | `BIGINT` minor units | In the account currency; a decimal string in the API, signed, zero allowed, `\|value\| ≤ 10¹³` minor units on the absolute value |
| `reconciledAt` | nullable `DATETIME` | `NULL` means `open`, a value means `finished`; undo sets it back to `NULL` |
| `createdAt` / `updatedAt` | | |

- **State is derived from `reconciledAt`**, so there is no separate status column. Undo is a pure
  state change, and two columns that could disagree are avoided. (`BillPayment` uses a `status`
  varchar because its two states carry different columns; this entity does not.) The API still
  exposes `status: 'open' | 'finished'`.
- **One open statement per account, enforced in the DB**: a generated column
  `open_key = IF(reconciled_at IS NULL, account_id, NULL)` with a unique index. This mirrors
  `active_name_key` in [Accounts — Name uniqueness](accounts.md#name-uniqueness). Starting a
  second statement races into the index and answers 409 `RECONCILIATION_OPEN`.
- **Index** `(account_id, statement_date)` serves the latest-finished lookup, the history order
  and the chronology check.

**`Transaction` change.** A nullable `reconciliationId` (`reconciliation_id`), FK to
`bank_reconciliations.id` `ON DELETE SET NULL` (cancelling an open statement drops its ticks),
plus an index `(reconciliation_id)`.

- **Ticked** — the row is linked to the account's `open` statement.
- **Cleared** — the row is linked to a `finished` statement.
- **Uncleared** — the column is `NULL`.
- The column is never accepted in a transaction body: it joins the list of fields that answer 400
  (`reconciliation_id` and `reconciliation`).

**Eligibility to tick.** The row belongs to the statement's account, is dated at least
`openingDate` and at most `statementDate`, and is not cleared by another statement. Moving
`statementDate` earlier unlinks the ticked rows that now fall after it, in the same DB
transaction.

## Formulas

Computed, never stored (checkpoint anchors were rejected, see
[Alternatives considered](#alternatives-considered)):

- **cleared balance** = `openingBalance` + SUM(amount of rows dated on or after `openingDate`
  linked to any finished statement of the account);
- **ticked sum** = SUM(amount of rows linked to the open statement);
- **difference** = `statementBalance` − (cleared balance + ticked sum).

The queries live in `AccountBalancesQuery` (`backend/src/bank/account-balances.query.ts`), next to
`currentBalance()`, and in `reconciliation.query.ts`.

### Queries and indexes

Each computed value is one indexed `SUM` or `COUNT`, never in-memory work over rows. No numeric
latency target is set.

| Value | Query | Index | Cost |
|---|---|---|---|
| Cleared balance | The `currentBalance()` shape (`SUM(t.amount)` with `WHERE t.account_id = :account AND t.date >= a.opening_date`), plus `INNER JOIN bank_reconciliations r ON r.id = t.reconciliation_id AND r.account_id = t.account_id AND r.reconciled_at IS NOT NULL` | `idx_bank_transactions_account_id_date_id` `(account_id, date, id)` serves the range; each join is a PK lookup on `bank_reconciliations` | The account's whole ledger in the worst case, the same as `currentBalance()` |
| Ticked sum | `SUM(t.amount) WHERE t.reconciliation_id = :open AND t.account_id = :account` | `(reconciliation_id)` | Proportional to the ticked rows, not to the ledger size |
| Difference | Computed in the service as a `BigInt` from the two `SUM` strings, never a `Number` | none | Constant |
| `transaction_count` (statement and history rows) | `COUNT(*)` grouped by `reconciliation_id`; the history page runs one grouped query for its at most 50 statement ids, never one query per row | `(reconciliation_id)` | Proportional to the rows of those statements |
| Latest finished statement, chronology check, history order | `bank_reconciliations` by `account_id`, ordered by `statement_date` | `(account_id, statement_date)` | Bounded by the statements of one account |
| One open statement and the start race | The unique `open_key` | `open_key` | Constant |

- `open_key` holds an `INT`, not a string, so unlike `active_name_key` it needs no collation.
- The ledger query adds the statement to each row with a `LEFT JOIN` placed **outside** the window
  subquery, on the at most 50 limited rows, so the whole-ledger window `SUM` of the running
  balance is not widened. See
  [Routes — Bank](../../backend/routes/bank.md#reconciliation-locks-on-existing-routes).

**Debt sign.** `statementBalance` is stored signed like the ledger. On a debt the statement shows
the positive amount owed, so the UI negates it (as it does for the opening balance) and the API
always takes and returns the signed value.

## Statement lifecycle

| Step | Preconditions | Errors |
|---|---|---|
| Start | Account not archived; no open statement; `statementDate` ≥ `openingDate`, ≤ UTC today + 1 day, and strictly after the latest finished statement | 409 `ACCOUNT_ARCHIVED`, `RECONCILIATION_OPEN`, `RECONCILIATION_OUT_OF_ORDER`; 400 for a date before `openingDate` or later than UTC today + 1 day |
| Edit while open | Statement is `open`; same date rules as start | 409 `RECONCILIATION_FINISHED`, `RECONCILIATION_OUT_OF_ORDER`, `ACCOUNT_ARCHIVED` |
| Tick / untick | Statement is `open`; ticked rows are eligible | 409 `RECONCILIATION_FINISHED`, `TRANSACTION_NOT_ELIGIBLE`, `ACCOUNT_ARCHIVED` |
| Finish | Statement is `open`; difference is 0 | 409 `RECONCILIATION_UNBALANCED`, `RECONCILIATION_FINISHED`, `ACCOUNT_ARCHIVED` |
| Undo | Statement is the latest finished one and no statement is open | 409 `RECONCILIATION_NOT_LATEST`, `RECONCILIATION_OPEN`, `RECONCILIATION_NOT_FINISHED`, `ACCOUNT_ARCHIVED` |
| Cancel | Statement is `open` | 409 `RECONCILIATION_FINISHED`, `ACCOUNT_ARCHIVED` |

- **Editing a finished statement is not allowed:** undo it first.
- **Undo keeps the ticks.** The statement returns to `open` with its rows still linked, and the
  rows unlock.
- **Cancel drops the ticks.** The rows become uncleared again.
- A zero-row statement is allowed, to confirm a period with no activity.
- A statement covers rows dated on or before `statementDate`. Same-day rows not yet posted by the
  bank are simply left unticked; there is no time-of-day handling.
- **Chronology.** Statements are chronological: a new statement date must be strictly after the
  latest finished one, and only the latest finished statement can be undone.

## Lock matrix

| Row state | PATCH `amount` / `date` | PATCH `description` / `notes` | DELETE | Undo of the generating bill payment (the three payment DELETEs) |
|---|---|---|---|---|
| Uncleared | Allowed | Allowed | Allowed | Allowed |
| Open-ticked | Allowed | Allowed | Allowed (the tick is dropped) | Allowed (the tick is dropped) |
| Cleared | 409 `TRANSACTION_CLEARED` only if the value changes | Allowed | 409 `TRANSACTION_CLEARED` | 409 `TRANSACTION_CLEARED` |

- Sending an unchanged `amount` or `date` on a cleared row is accepted, so forms that send every
  field keep working.
- An edit that moves a ticked row's date past `statementDate`, or before `openingDate`, unticks it.
- No role bypasses the lock, `admin` included. The only way to change a locked field or delete the
  row is to undo the statement first.
- **Opening anchor.** `openingDate` and `openingBalance` are locked once any statement exists,
  open or finished: 409 `ACCOUNT_RECONCILED`. The currency is locked the same way
  (`CURRENCY_LOCKED`). See [Accounts](accounts.md#statements) and
  [Routes — Bank](../../backend/routes/bank.md#reconciliation-locks-on-existing-routes).
- The accountant hand-off mark and the cleared marker are independent (see
  [Provider expense](provider-expense.md)).

## Migration

One additive migration: create the table, add the column with its FK and index, and add the
generated `open_key` unique index. There is **no backfill**.

File: `backend/src/database/migrations/20261123120027-bank-create-reconciliations.ts`, class
`BankCreateReconciliations20261123120027`.

**Raw SQL.** The generated column, its unique index and the FK addition are written as raw SQL,
because TypeORM's `getTable` and generated-column helpers hit a `typeorm_metadata` table that the
project never creates. The precedents are `20261108120016-bank-create-accounts.ts` for the
generated column and `20261117120025-bank-expand-provider-bills.ts` for a nullable FK and index
on an existing table.

**`up()`**, in this order:

1. Create `bank_reconciliations` (columns, FK `account_id` to `bank_accounts.id`
   `ON DELETE CASCADE`, index `(account_id, statement_date)`).
2. Raw SQL: add the generated column
   `open_key INT AS (IF(reconciled_at IS NULL, account_id, NULL)) VIRTUAL` and its unique index.
3. Raw SQL on `bank_transactions`: `ADD COLUMN reconciliation_id INT NULL`, the
   `idx_bank_transactions_reconciliation_id` index, and the FK to `bank_reconciliations(id)`
   `ON DELETE SET NULL`.

**`down()`** is reversible, in reverse order: drop the `bank_transactions` FK, then its index, then
the column (each guarded through `information_schema`), then `DROP TABLE IF EXISTS
bank_reconciliations`. **Reconcile data is lost on rollback**: statements and ticks are not
preserved by `down()`.

**Backward compatibility.** Every existing transaction starts uncleared. Existing clients keep
working: the new response fields (`reconciliation`, `last_reconciled_date`,
`last_reconciliation`, `open_reconciliation_id`) are additive and `null` on every existing row,
and the new 409s (`TRANSACTION_CLEARED`, `ACCOUNT_RECONCILED`, the widened `CURRENCY_LOCKED`)
apply only once a statement exists.

## Concurrency

Every reconciliation write, the account PATCH, archive and delete, the transaction PATCH and
DELETE, and the three payment undos run in one DB transaction with the same fixed lock order, so
there is no deadlock between them:

1. the account row, `SELECT … FOR UPDATE` (re-read inside the transaction, `archivedAt`
   rechecked there, and a missing row answers the uniform 404);
2. the statement row, `FOR UPDATE`;
3. the transaction rows, `FOR UPDATE` in ascending id order (including the several rows that
   `undoPayment()` removes).

An unexpected `ER_LOCK_DEADLOCK` maps to a uniform 409 retry-style error with fixed text, never a
500 carrying detail.

- **Two concurrent starts.** The loser hits `ER_DUP_ENTRY` on the unique `open_key`, mapped to 409
  `RECONCILIATION_OPEN`, never a 500. A pre-check keeps the friendly path.
- **Undo vs. start.** The account lock serialises them, and the loser answers 409
  `RECONCILIATION_OPEN`.
- **Tick vs. transaction PATCH or DELETE.** The transaction write locks the row and checks
  `reconciliationId` on current data. PATCH first: the tick then sees the new date and answers 409
  `TRANSACTION_NOT_ELIGIBLE`. Tick first: the PATCH sees a ticked, not cleared, row and succeeds
  (with the auto-untick rule). DELETE first: the tick batch answers 404 and rolls back whole.
- **Finish vs. tick, and finish vs. PATCH or DELETE of a ticked row.** Finish locks the statement
  and then the ticked rows, recomputes the difference under the lock, and sets `reconciled_at`
  with `UPDATE … WHERE reconciled_at IS NULL`, checking the affected rows. A tick after finish
  answers 409 `RECONCILIATION_FINISHED`.
- **Payment undo vs. finish.** The undo rechecks `TRANSACTION_CLEARED` under the same row locks.
- **Account PATCH (`opening_*`, currency) and archive vs. start or tick.** They take the account
  lock and recheck "a statement exists" inside it.

## Memory

The feature adds no meaningful resident memory and a bounded, small per-request footprint. It fits
the 512 MB Render tier.

- **Lazy module.** `ReconciliationsController` is the only resident addition (registered in
  `bank-routes.module.ts`, importing service types only). `ReconciliationService`, its queries and
  `reconciliation-conflicts.ts` load with the rest of `BankModule` on the first bank request.
- **Bulk tick** (at most 50 raw ids, one DB transaction): de-duplicate the ids, one account-scoped
  `SELECT … FOR UPDATE` of narrow columns (`id`, `date`, `amount`, `reconciliation_id`), one bulk
  `UPDATE` for `tick` and one for `untick`, then recompute the statement with the two `SUM`
  queries. No entity hydration of full rows and no per-id query.
- **Ledger page with reconcile data.** The same 50 rows as before, each with one more small
  object, plus one scalar in the envelope. The difference and the balances are computed in SQL.
- **Finish and undo** update one statement row and run the two `SUM`s under lock.

## Data sensitivity and ownership

| Topic | Decision |
|---|---|
| Roles | Start, edit statement, tick and finish need `user` (everyday writes). Cancel (a DELETE) and undo need `admin`, like every DELETE and payment undo. GETs are open to every member. Each write route declares `@MinOrgRole`. Finish stays `user`: it only works at difference 0, and undo is the sanctioned `admin` way out of the lock it creates. The locks are 409s checked after the role 403, so no role bypasses them |
| Ownership | Statements inherit the owner through their account and never store an owner column. Every route resolves the account owner-scoped first: a uniform 404 for a foreign, wrong-context or non-member id, and global `is_admin` gets no bypass. Every statement lookup is by `{ id, accountId }`, so a statement of a sibling account answers the same 404 as an unknown id, never a 409. A ticks body may only name transactions of the same account (one account-scoped query); any miss answers 404 and rejects the whole batch. No 404 or 409 message names an id |
| Response fields | Every new field is derived from the caller's own, owner-scoped account and carries no owner, user or member field. The ledger-row `reconciliation` comes from a `LEFT JOIN` on `r.id = t.reconciliation_id AND r.account_id = t.account_id`, and the cleared-balance `SUM` is scoped the same way |
| Account payload | `last_reconciliation` and `open_reconciliation_id` are on the account **detail only**, not on the list: no list UI reads them, and `statement_balance` is financial data that nothing on the list needs |
| Data sensitivity | Statement balances are financial data. Bodies are never logged, and TypeORM query or parameter logging must stay off on these routes. All new 409 messages are fixed static text: they never carry a balance, difference, sum, date, id or count. 400 messages never echo the offending value |
| Cache | No route is `public`. GETs are `user-scoped`, writes are `never` with `InvalidatesOwner()`. Navi warms nothing. See [Routes — Bank](../../backend/routes/bank.md#reconciliation-caching) |

### Input bounds

- **Ticks body** (`tick` and `untick`): reuses the `MarkChargesDto` pattern: `@IsArray()`,
  `@ArrayMaxSize(50)`, and `@IsInt({ each })`, `@Min(1, { each })`, `@Max(MAX_ID, { each })`. Each
  array is optional and defaults to `[]`. A malformed id inside the body is a **400** through
  `@StrictBody()`, not `parseId`'s 404. A non-array or non-integer value, and any extra field, is
  a 400.
  - **Duplicates** inside one array are accepted and de-duplicated by the service. The cap of 50
    applies to the raw array length, before de-duplication.
  - `tick` and `untick` must be disjoint, checked after de-duplication, and at least one must be
    non-empty after it. Both violations are a 400 with a fixed message.
  - `untick` only affects rows linked to **this** open statement. An id that is unlinked, or
    linked to a finished statement, is a no-op, so an untick can never unclear a cleared row.
- **Statement date** (POST and PATCH): reuses `IsLedgerDate` / `isAllowedLedgerDate`
  (`backend/src/bank/ledger-date.ts`): a real calendar day, at most **UTC today + 1 day**. The UI
  `max` of today is a UX default only: the server is the authority.
  - The lower bound `statement_date >= opening_date` (inclusive) is a 400 in the
    account-dependent step, with a fixed message that echoes no value.
  - The chronology rule, strictly after the latest finished `statement_date`, is a 409
    `RECONCILIATION_OUT_OF_ORDER`. A date that breaks both rules answers the 400 first. On PATCH
    of an open statement the comparison is against finished statements only.
- **Statement balance**: a signed decimal string, parsed against the account currency with no
  non-zero requirement. The bound is `|value| <= 10¹³` minor units on the **absolute value**.
  Negative values (overdrafts and debts) and zero (a zero-row statement) are allowed. The decimal
  places must match the currency exponent, and strings over 32 characters are rejected.
  `difference` is computed as a `BigInt`, never a `Number`.
- **Mass assignment**: `account_id`, `status`, `reconciled_at`, `reconciliation_id` and
  `reconciliation` in any body answer 400 (`@StrictBody()` whitelist).

## Mismatch surfacing

None beyond the reconcile-mode difference bar and the ledger warning badge. There is no
account-list indicator and no notifications. `last_reconciliation` and `open_reconciliation_id`
stay off the list payload.

## Alternatives considered

- **Flag only** (cleared flag and cleared balance, compared by eye): rejected. Ward never knows
  the statement balance, so it cannot surface a mismatch itself.
- **Flag plus statement plus import**: rejected for this epic. Parsers, fuzzy matching and an
  upload surface are a much larger, separate concern.
- **Full lock** (no edit at all on a cleared row): rejected. It blocks harmless typo fixes in
  description and notes.
- **Soft lock** (edit allowed, the row is un-cleared and the statement flagged broken): rejected.
  It reintroduces the silent drift this feature exists to remove.
- **Checkpoint anchors** (each finished statement becomes a new balance anchor): rejected.
  (1) There is no second source of truth: no stored per-statement balance can drift from the
  ledger. (2) Undo stays a plain revert of the latest statement, with no re-anchoring to unwind.
  (3) The cleared-row locks already protect the history that a checkpoint would freeze.

## Deferred

Recorded here with the follow-up epics created at fold time (#157):

- Statement import (OFX / CSV upload and automatic matching): [#175](https://github.com/darthjee/ward/issues/175)
- Statement-to-ledger drill-down (open the ledger filtered to one statement's rows): [#176](https://github.com/darthjee/ward/issues/176)
- Statement audit log (who started, ticked, finished, undid and cancelled a statement; overlaps
  [#95](https://github.com/darthjee/ward/issues/95)): [#177](https://github.com/darthjee/ward/issues/177)
- Cross-account / linked transfers: [#86](https://github.com/darthjee/ward/issues/86)
- Currency conversion: [#88](https://github.com/darthjee/ward/issues/88)
