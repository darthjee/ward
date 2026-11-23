# Reconciliation — Data model and lock rules

Part of the [Reconciliation spec](README.md). This file defines the new entity, the change to
`Transaction`, the formulas, the statement lifecycle, the lock matrix and the migration.

## `Reconciliation` entity

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
  `active_name_key` in
  [Accounts — Name uniqueness](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/accounts.md#name-uniqueness).
  Starting a second statement races into the index and answers 409 `RECONCILIATION_OPEN`.
- **Index** `(account_id, statement_date)` serves the latest-finished lookup, the history order
  and the chronology check.

## `Transaction` change

A new nullable `reconciliationId` (`reconciliation_id`), FK to `bank_reconciliations.id`
`ON DELETE SET NULL` (cancelling an open statement drops its ticks), plus an index
`(reconciliation_id)`.

- **Ticked** — the row is linked to the account's `open` statement.
- **Cleared** — the row is linked to a `finished` statement.
- **Uncleared** — the column is `NULL`.
- The column is never accepted in a transaction body: it joins the list of fields that answer 400.

**Eligibility to tick.** The row belongs to the statement's account, is dated at least
`openingDate` and at most `statementDate`, and is not cleared by another statement. Moving
`statementDate` earlier unlinks the ticked rows that now fall after it, in the same DB
transaction.

## Formulas

Computed, never stored:

- **cleared balance** = `openingBalance` + SUM(amount of rows dated on or after `openingDate`
  linked to any finished statement of the account);
- **ticked sum** = SUM(amount of rows linked to the open statement);
- **difference** = `statementBalance` − (cleared balance + ticked sum).

The queries go in `AccountBalancesQuery` (`backend/src/bank/account-balances.query.ts`), next to
`currentBalance()`, with a join on `bank_reconciliations`. See
[Queries and indexes](#queries-and-indexes).

### Queries and indexes

Each computed value is one indexed `SUM` or `COUNT`, never in-memory work over rows. No numeric
latency target is set: cost is stated qualitatively.

| Value | Query | Index | Cost |
|---|---|---|---|
| Cleared balance | The `currentBalance()` shape (`SUM(t.amount)` with `WHERE t.account_id = :account AND t.date >= a.opening_date`), plus `INNER JOIN bank_reconciliations r ON r.id = t.reconciliation_id AND r.account_id = t.account_id AND r.reconciled_at IS NOT NULL` | `idx_bank_transactions_account_id_date_id` `(account_id, date, id)` serves the range; each join is a PK lookup on `bank_reconciliations` | The account's whole ledger in the worst case, the same as `currentBalance()` today |
| Ticked sum | `SUM(t.amount) WHERE t.reconciliation_id = :open AND t.account_id = :account` | `(reconciliation_id)` | Proportional to the ticked rows, not to the ledger size |
| Difference | Computed in the service as a `BigInt` from the two `SUM` strings, never a `Number` | none | Constant |
| `transaction_count` (statement and history rows) | `COUNT(*)` grouped by `reconciliation_id`; the history page runs one grouped query for its at most 50 statement ids, never one query per row | `(reconciliation_id)` | Proportional to the rows of those statements |
| Latest finished statement, chronology check, history order | `bank_reconciliations` by `account_id`, ordered by `statement_date` | `(account_id, statement_date)` | Bounded by the statements of one account |
| One open statement and the start race | The unique `open_key` | `open_key` | Constant |

- The spec allows both `SUM`s to come from one statement with conditional `SUM`s. That is an
  implementation choice and is not mandated.
- `open_key` holds an `INT`, not a string, so unlike `active_name_key` it needs no collation.
- The ledger and account-detail queries are in
  [api/existing-routes.md](api/existing-routes.md#transactions).
- The memory footprint is in [security.md](security.md#memory).

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

## Lock matrix

| Row state | PATCH `amount` / `date` | PATCH `description` / `notes` | DELETE | Undo or delete of the generating bill payment |
|---|---|---|---|---|
| Uncleared | Allowed | Allowed | Allowed | Allowed |
| Open-ticked | Allowed | Allowed | Allowed (the tick is dropped) | Allowed (the tick is dropped) |
| Cleared | 409 `TRANSACTION_CLEARED` only if the value changes | Allowed | 409 `TRANSACTION_CLEARED` | 409 `TRANSACTION_CLEARED` |

- Sending an unchanged `amount` or `date` on a cleared row is accepted, so forms that send every
  field keep working.
- An edit that moves a ticked row's date past `statementDate`, or before `openingDate`, unticks it (edge case).
- No role bypasses the lock, `admin` included. The only way to change a locked field or delete the
  row is to undo the statement first.
- **Opening anchor.** `openingDate` and `openingBalance` are locked once any statement
  exists, open or finished: 409 `ACCOUNT_RECONCILED`. The currency is locked the same way
  (`CURRENCY_LOCKED`). See [api/existing-routes.md](api/existing-routes.md).

## Migration

One additive migration: create the table, add the column with its FK and index, and add the
generated `open_key` unique index. There is **no backfill**.

File: `backend/src/database/migrations/<YYYYMMDD>120027-bank-create-reconciliations.ts`, class
`BankCreateReconciliations<YYYYMMDD>120027`. The sequence counter continues after
`20261120120026-bank-contract-provider-bills.ts`.

**Raw SQL.** The generated column, its unique index and the FK addition are written as raw SQL,
because TypeORM's `getTable` and generated-column helpers hit a `typeorm_metadata` table that the
project never creates. The precedents are `20261108120016-bank-create-accounts.ts` for the
generated column (`active_name_key ... VIRTUAL` and its unique index) and
`20261117120025-bank-expand-provider-bills.ts` for a nullable FK and index on an existing table.

**`up()`**, in this order:

1. Create `bank_reconciliations`:
   - columns `id`, `account_id`, `statement_date DATE`, `statement_balance BIGINT`,
     `reconciled_at DATETIME NULL`, `created_at`, `updated_at`;
   - FK `account_id` to `bank_accounts.id` `ON DELETE CASCADE`;
   - index `(account_id, statement_date)`.
2. Raw SQL: add the generated column
   `open_key INT AS (IF(reconciled_at IS NULL, account_id, NULL)) VIRTUAL` and its unique index.
3. Raw SQL on `bank_transactions`:
   - `ADD COLUMN reconciliation_id INT NULL`;
   - `ADD INDEX idx_bank_transactions_reconciliation_id (reconciliation_id)`;
   - `ADD CONSTRAINT fk_... FOREIGN KEY (reconciliation_id) REFERENCES bank_reconciliations(id)
     ON DELETE SET NULL`.

**`down()`** is reversible, in reverse order:

1. Drop the `bank_transactions` FK, then its index, then the `reconciliation_id` column, each step
   guarded through `information_schema` (as in `20261117120025-bank-expand-provider-bills.ts`).
2. Drop `bank_reconciliations` with `DROP TABLE IF EXISTS`. That also removes `open_key`, its
   unique index, the `(account_id, statement_date)` index and the account FK.

**Reconcile data is lost on rollback**: statements and ticks are not preserved by `down()`.

### Backward compatibility

- Every existing transaction starts uncleared (`reconciliation_id NULL`). No backfill runs.
- Existing clients keep working, for two reasons:
  - the new response fields are additive and `null` on every existing row: `reconciliation`,
    `last_reconciled_date`, `last_reconciliation` and `open_reconciliation_id`;
  - the new 409s apply only once a statement exists: `TRANSACTION_CLEARED`, `ACCOUNT_RECONCILED`
    and the widened `CURRENCY_LOCKED`. Until a user starts their first statement, every current
    rule and response behaves as today.
- `reconciliation_id` and `reconciliation` join the 400 mass-assignment list. A client that never
  sends them is unaffected.

## Reference

- [Epic #85](https://github.com/darthjee/ward/issues/85)
- [Bank — Transactions](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/transactions.md)
- [Bank — Accounts](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/accounts.md)
- [`bill-payment.entity.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/entities/bill-payment.entity.ts)
- [`account-balances.query.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/account-balances.query.ts)

## Required tests

- Unique-open index integration spec (`database/tests/integration/`).
- Migration unit spec `database/tests/bank-create-reconciliations-migration.spec.ts`, using
  `fake-query-runner.ts` and asserting the `up()` and `down()` call order.
- The migration registered in `MIGRATIONS` of `test-data-source.ts`, so
  `migrations-registry.integration-spec.ts` passes.
- `migrations-round-trip.integration-spec.ts` (up, down, up) stays green with the new migration.
- Formula units: anchor, rows before the anchor excluded, debt sign, zero-row statement.
- Eligibility and auto-untick units.

Back to the [README](README.md).
