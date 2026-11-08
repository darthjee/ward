# Transaction service and ledger query

Add the transaction CRUD and the paginated ledger with computed balances, inside the lazy
`BankModule`.

## DTOs

### `CreateTransactionDto`

| Field | Rule |
|---|---|
| `date` | Required; at most UTC today + 1 day. |
| `amount` | Required signed decimal string; zero, too many decimals and `> 10^13` minor units are rejected. |
| `description` | Required, trimmed, non-blank, at most 255 characters. |
| `notes` | Optional, at most 2000 characters. |

### `UpdateTransactionDto`

The same fields, all optional.

Neither DTO has `account_id`, `user_id`, `organization_id`, `sent_to_accountant_at` or
`balance`, so `@StrictBody()` rejects them with a 400. The amount is validated against the
**account's** currency inside the service, because the DTO cannot know it.

## `TransactionService`

- **Resolving the account:** every method first loads the account through
  `AccountService.find(owner, accountId)`, which is owner-scoped, so a wrong context or an
  unknown id gets a 404.
- **Resolving the transaction:** it is looked up by `{ id, accountId }`. A transaction of
  another account gets the same `ownerNotFound()` 404.
- **`create` / `update` / `delete`:** answer 409 `ACCOUNT_ARCHIVED` when the account is archived.
- **`ledger(owner, accountId, page)`:** delegates to `LedgerQuery`.

## `LedgerQuery` (`bank/ledger.query.ts`)

The raw SQL lives in a dedicated, fakeable class.

- **`count(accountId)`.**
- **`page(account, page, perPage)`:**
  - computes the running balance with a window function over the account's whole ledger
    **before** the `LIMIT`, then applies `ORDER BY date DESC, id DESC LIMIT/OFFSET` outside it;
  - the running balance of a row is
    `opening_effective + SUM(amount) OVER (ORDER BY date, id ROWS UNBOUNDED PRECEDING)`;
  - `opening_effective` is `opening_balance − SUM(amount WHERE date < opening_date)`.
- **`openingEffective(account)`:** used for the virtual opening row, whose `balance` equals its
  `amount`.
- **Current balance:** `opening_balance + SUM(amount WHERE date >= opening_date)`, the same
  formula as step 04's grouped query.

## The envelope

The service builds:

`{ transactions, opening, pagination }`

- `opening` is `{ date, amount, balance }` on the last page and `null` on every other page.
- A page past the last one returns `transactions: []` with the same metadata.
- Amounts and balances are formatted with the account's currency exponent.

## Tests

### Unit specs

Using a fake `LedgerQuery` and fake repositories:

- validation: zero amount, the decimals per currency (BRL 2, JPY 0, BHD 3), the 10¹³ cap,
  UTC today + 1 accepted and + 2 rejected, the length limits;
- archived account → 409;
- another account's transaction → 404;
- the envelope: `opening` only on the last page, an out-of-range page, a `page` parsed through
  `parsePage`.

### `ledger.integration-spec.ts`

Against MySQL, with the real SQL:

- newest first, and within a day ordered by `id`;
- 50 rows per page;
- the running balance is correct on every page and across page boundaries;
- current balance and the derived opening; a transaction dated on `opening_date` counts after
  the anchor;
- the worked backfilling example from `transactions.md`: an anchor of 10,000 on 1 Nov, then
  +15,000 and −10,000 in October, gives an opening of 5,000, a ledger of 5,000 → 20,000 → 10,000,
  and a balance of 10,000;
- the grouped balance query of step 04.

## Files to Change

- `backend/src/bank/dto/create-transaction.dto.ts` — new.
- `backend/src/bank/dto/update-transaction.dto.ts` — new.
- `backend/src/bank/transaction.service.ts` — new.
- `backend/src/bank/ledger.query.ts` — new.
- `backend/src/bank/transaction-response.ts` — new: transaction and ledger serialisers.
- `backend/src/bank/bank.module.ts` — provide `TransactionService` and `LedgerQuery`.
- `backend/src/bank/tests/transaction.service.spec.ts` — new.
- `backend/src/bank/tests/transaction-response.spec.ts` — new.
- `backend/src/database/tests/integration/ledger.integration-spec.ts` — new (or under `bank/tests/`, if the integration Jest config picks that up).
