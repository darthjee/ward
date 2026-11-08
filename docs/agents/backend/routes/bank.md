# Routes — Bank

Routes of the lazy `bank` module (`backend/src/bank/`), served by three thin resident
controllers: `AccountsController`, `TransactionsController` and `SettingsController`. Each is
declared with `@OwnerScopedController('bank')`, so every route is mounted under **both** base
paths (the external `/api` prefix is added by the proxy):

- **`<base>`** — `/bank` (personal: the owner is the JWT user) or `/orgs/:orgId/bank`
  (organization: the owner is `:orgId`, after `OwnerContextGuard`'s membership check).

The controllers parse the ids, load the lazy `BankModule` on the first bank request
(`BankModuleLoader` → `LazyModuleLoaderService#loadOnFirstRequest()`) and delegate to its
`AccountService` / `TransactionService`. `settings.json` reads the resident `BANK_CONFIG` and
does not load the module. The specs (`docs/agents/specs/banking/accounts/regular.md`,
`transactions.md`) are the source of truth for the behaviour.

## Shared rules

- **JWT-protected** (no `@Public()`), `.json` suffix, `snake_case` bodies.
- **Owner from the route only** — bodies are read only through `@StrictBody()`, so unknown
  fields, owner fields (`user_id`, `organization_id`, `userId`, `organizationId`), ids
  (`account_id`, `accountId`) and computed fields (`balance`) answer `400 VALIDATION_FAILED`.
  Responses never contain owner fields.
- **404, never 403** — every miss answers the same body
  (`{ error: { code: 'NOT_FOUND', message: 'Not Found' }, statusCode: 404, timestamp }`): an
  unknown or non-numeric id (ids go through `parseId`, never `ParseIntPipe`), another user's
  personal account, another organization's account, the wrong context (an organization account
  on a personal route, or the reverse), a transaction of another account, a non-member `:orgId`,
  and a global admin who is not a member (no admin bypass).
- **Caching** — `GET` routes are `user-scoped` (`X-Skip-Cache: true`,
  `Cache-Control: private, no-store`); writes are `never` (`X-Skip-Cache: true`,
  `Cache-Control: no-store`). None goes into Navi's warm-up.
- **Amounts** are decimal strings in the account currency's exponent (BRL/USD 2, JPY 0,
  BHD 3; e.g. `"-1234.56"`, `"500"`), stored as `BIGINT` minor units. More decimals than the
  currency allows, or `|amount|` over 10¹³ minor units → `400`.
- **Dates** are `YYYY-MM-DD`, never after UTC today + 1 day.
- **Bodies are never logged** (only method, route and status).

## Account response

```json
{
  "id": 12, "type": "regular", "name": "Nubank", "bank_name": "Nu", "branch": "0001",
  "account_number": "•••• 1234", "currency": "BRL",
  "opening_date": "2026-10-01", "opening_balance": "1000.00", "balance": "987.50",
  "archived_at": null, "notes": null,
  "created_at": "2026-11-08T10:00:00.000Z", "updated_at": "2026-11-08T10:00:00.000Z"
}
```

- `account_number` is masked (`•••• ` + last 4 characters) in the list, full in every other
  response.
- `balance` (current balance) = `opening_balance` + SUM(transactions dated on or after
  `opening_date`); on the list it comes from one grouped query.
- A later account type adds its nested object under its type name (`debt`, `investment`,
  `provider_expense`); `regular` has none.

## Accounts

| Method | Route | Body | Success | Errors | Cache class |
|---|---|---|---|---|---|
| GET | `<base>/accounts.json?type=regular&archived=false` | — | `200` list of accounts, sorted by name; `archived=true` also lists archived ones (with `archived_at` set) | `400` type without a handler, invalid `archived` | `user-scoped` |
| POST | `<base>/accounts.json` | `CreateAccountDto` | `201` account | `400` validation / non-`regular` type; `409 ACCOUNT_NAME_TAKEN` | `never` |
| GET | `<base>/accounts/:accountId.json` | — | `200` account (full number) | `404` | `user-scoped` |
| PATCH | `<base>/accounts/:accountId.json` | `UpdateAccountDto` | `200` account | `400`; `404`; `409 ACCOUNT_ARCHIVED` (anything but `name` on an archived account), `CURRENCY_LOCKED` (currency change once the account has transactions), `ACCOUNT_NAME_TAKEN` | `never` |
| DELETE | `<base>/accounts/:accountId.json` | — | `204` | `404`; `409 ACCOUNT_HAS_TRANSACTIONS` (message points to archive; also on the FK race) | `never` |
| POST | `<base>/accounts/:accountId/archive.json` | — | `200` account (idempotent) | `404` | `never` |
| POST | `<base>/accounts/:accountId/unarchive.json` | — | `200` account (idempotent) | `404`; `409 ACCOUNT_NAME_TAKEN` | `never` |

`CreateAccountDto`:

| Field | Rule |
|---|---|
| `type` | Optional, default `regular`; any type without a registered handler → `400` |
| `name` | Required; trimmed, non-blank, at most 255 characters; unique per owner among active accounts, case-insensitively (accent-sensitive) |
| `bank_name`, `branch`, `account_number` | Optional, at most 64 characters; trimmed, blank → `null` |
| `currency` | Optional ISO 4217 code from `Intl.supportedValuesOf('currency')`; defaults to `BANK_DEFAULT_CURRENCY` |
| `opening_date` | Optional, defaults to UTC today |
| `opening_balance` | Optional decimal string, default `"0"` |
| `notes` | Optional, at most 2000 characters |

`UpdateAccountDto` has the same fields except `type` (sending it → `400`), all optional;
`null` clears an optional field. Changing `currency` before any transaction keeps the opening
balance's decimal value (`400` when it cannot be represented in the new exponent).

## Transactions

| Method | Route | Body | Success | Errors | Cache class |
|---|---|---|---|---|---|
| GET | `<base>/accounts/:accountId/transactions.json?page=N` | — | `200` ledger envelope | `400` invalid `page`; `404` | `user-scoped` |
| POST | `<base>/accounts/:accountId/transactions.json` | `CreateTransactionDto` | `201` transaction | `400`; `404`; `409 ACCOUNT_ARCHIVED` | `never` |
| PATCH | `<base>/accounts/:accountId/transactions/:transactionId.json` | `UpdateTransactionDto` | `200` transaction | `400`; `404`; `409 ACCOUNT_ARCHIVED` | `never` |
| DELETE | `<base>/accounts/:accountId/transactions/:transactionId.json` | — | `204` (hard delete) | `404`; `409 ACCOUNT_ARCHIVED` | `never` |

`CreateTransactionDto`: `date` (required), `amount` (required signed decimal string, non-zero,
validated against the **account's** currency), `description` (required, trimmed, non-blank, at
most 255 characters), `notes` (optional, at most 2000 characters). `UpdateTransactionDto`: the
same fields, all optional. A transaction never moves between accounts.

Transaction response: `{ id, date, amount, description, notes, created_at, updated_at }`.

### Ledger envelope and pagination

The project's first paginated route; the `pagination` block is the convention for later ones.

```json
{
  "transactions": [ { "id": 7, "date": "2026-11-01", "amount": "-12.50",
                      "description": "…", "notes": null, "balance": "987.50" } ],
  "opening": { "date": "2026-10-01", "amount": "1000.00", "balance": "1000.00" },
  "pagination": { "page": 1, "per_page": 50, "total_pages": 3, "total_count": 120 }
}
```

- 50 rows per page, newest first (within a day, by `id`, newest first).
- `balance` is the running balance, computed with a window function over the account's whole
  ledger before the `LIMIT`, so it is correct across pages.
- `opening` is the virtual opening row (`opening_balance` − SUM(transactions dated before
  `opening_date`); its `balance` equals its `amount`). It is set only on the last page and is
  `null` on every other page.
- `page` defaults to `1`; a non-numeric or `< 1` page → `400`. A page past the last answers
  `transactions: []` and `opening: null` with the same metadata. `total_pages` is at least 1, so
  an empty ledger has one page holding the opening row.

## Settings

| Method | Route | Success | Errors | Cache class |
|---|---|---|---|---|
| GET | `<base>/settings.json` | `200 { "default_currency": "BRL" }` from `BANK_DEFAULT_CURRENCY` (same value under both prefixes) | `404` non-member `:orgId` | `user-scoped` |
