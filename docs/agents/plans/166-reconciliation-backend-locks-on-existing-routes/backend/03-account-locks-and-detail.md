# Account anchor and currency locks, detail fields

**PATCH (`AccountService.update()`)**: run the reconciliation checks under the account row lock.
Keep `account.service.ts` under the size limit by putting the logic in a new helper (for example
`account-reconciliation-guard.ts`, with a function such as
`assertAnchorUnlocked(manager, account, dto)`).

- Move the update into one `mapDeadlock(() => manager.transaction(...))` that starts with
  `lockAccount(manager, owner, id)`. Keep `#saveWithDetails`' `mapNameClash` mapping around the
  whole transaction. The existing checks keep their order: 404, `assertNoForeignNested`, archived,
  currency, handler validation, 400 parsing.
- "A statement exists" means any `bank_reconciliations` row for the account, open or finished.
  Add a cheap query, for example `ReconciliationQuery.hasAny(accountId, manager)` (an `EXISTS` on
  the `(account_id, statement_date)` index), and mirror it in the in-memory twin.
- `ACCOUNT_RECONCILED` (`accountReconciled()`): when a statement exists and `opening_date`, or the
  parsed `opening_balance` (compared as minor units), differs from the stored value. Unchanged
  values and a `name` edit pass.
- `#applyCurrency`: `CURRENCY_LOCKED` when a currency change is requested and
  `hasTransactions || hasAnyStatement`. This covers a zero-row statement. Update the
  `currencyLocked()` message text accordingly.
- The checks run once, in `AccountService`, so the typed accounts (debt, provider-expense,
  investment) get them through the shared controller and service without per-handler code.

**Detail fields**: `last_reconciliation: { statement_date, statement_balance, reconciled_at } | null`
and `open_reconciliation_id: number | null`, on the detail only.

- Add a `detailExtras` option to `AccountPresenter.present()`, passed only by `presentOne()` on
  the `find()` path. Then the list pays nothing and there is no N+1. Fetch with
  `ReconciliationQuery.latestFinished` and `openStatement` (both served by the
  `(account_id, statement_date)` index and the `open_key`). Serialize `statement_balance` as a
  decimal string, like other money fields.
- Check whether PATCH / POST responses also go through `presentOne()`. The spec only requires the
  detail GET. Keep the list response unchanged.

Tests:

- `accounts.e2e-spec.ts`: `ACCOUNT_RECONCILED` on `opening_date` alone, on `opening_balance` alone
  and on both, while open, after a finish and after an undo. It is allowed again after a cancel
  removes the last statement. Unchanged `opening_*` values are accepted. A `name` edit works.
  `CURRENCY_LOCKED` with an open statement and with a zero-row statement, released after cancel.
  The list lacks the two fields, and the detail carries them after finish, undo and cancel.
  Deleting an account with a zero-row statement and no transactions still works.
- The same anchor and currency locks in `debt-accounts.e2e-spec.ts`,
  `provider-expense-accounts.e2e-spec.ts` and `investment-accounts.e2e-spec.ts`.
- Units: `account.service.spec.ts` (lock taken, check order), `account.presenter.spec.ts` (no
  reconciliation queries on the list), `account-response.spec.ts` (the field shapes), and the
  new guard's spec.
- Add the `reconciliation.query` in-memory mock to the account e2e specs that need it.

## Files to Change
- `backend/src/bank/account.service.ts` — locked update, delegates to the new guard
- `backend/src/bank/account-reconciliation-guard.ts` (new) — anchor and statement-aware currency checks
- `backend/src/bank/account-conflicts.ts` — widened `currencyLocked()` text
- `backend/src/bank/reconciliation.query.ts` — `hasAny(accountId, manager?)`
- `backend/src/bank/tests/support/in-memory-reconciliation.query.ts` — `hasAny` twin
- `backend/src/bank/account.presenter.ts` — `detailExtras` option
- `backend/src/bank/account-response.ts` — `last_reconciliation`, `open_reconciliation_id`
- `backend/src/bank/tests/accounts.e2e-spec.ts`, `debt-accounts.e2e-spec.ts`, `provider-expense-accounts.e2e-spec.ts`, `investment-accounts.e2e-spec.ts` — lock and detail cases
- `backend/src/bank/tests/account.service.spec.ts`, `account.presenter.spec.ts`, `account-response.spec.ts` and a new guard spec — units
