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

The query goes in `AccountBalancesQuery` (`backend/src/bank/account-balances.query.ts`), next to
`currentBalance()`, with a join on `bank_reconciliations`.

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

One additive migration: create the table, add the column with its FK and index, no backfill.
Name: `backend/src/database/migrations/<YYYYMMDD>120027-bank-create-reconciliations.ts` (the
sequence counter continues after `20261120120026-bank-contract-provider-bills.ts`). It is
backward compatible: every existing row starts uncleared and every current rule keeps working.
The rollback drops the column and then the table.

## Reference

- [Epic #85](https://github.com/darthjee/ward/issues/85)
- [Bank — Transactions](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/transactions.md)
- [Bank — Accounts](https://github.com/darthjee/ward/blob/main/docs/agents/modules/bank/accounts.md)
- [`bill-payment.entity.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/entities/bill-payment.entity.ts)
- [`account-balances.query.ts`](https://github.com/darthjee/ward/blob/main/backend/src/bank/account-balances.query.ts)

## Required tests

- Unique-open index integration spec (`database/tests/integration/`).
- Migration up and down spec.
- Formula units: anchor, rows before the anchor excluded, debt sign, zero-row statement.
- Eligibility and auto-untick units.

Back to the [README](README.md).
