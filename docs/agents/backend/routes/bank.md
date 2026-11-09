# Routes — Bank

Routes of the lazy `bank` module (`backend/src/bank/`), served by four thin resident
controllers: `AccountsController`, `TransactionsController`, `SettingsController` and
`AccountantController`. Each is
declared with `@OwnerScopedController('bank')`, so every route is mounted under **both** base
paths (the external `/api` prefix is added by the proxy):

- **`<base>`** — `/bank` (personal: the owner is the JWT user) or `/orgs/:orgId/bank`
  (organization: the owner is `:orgId`, after `OwnerContextGuard`'s membership check).

The controllers parse the ids, load the lazy `BankModule` on the first bank request
(`BankModuleLoader` → `LazyModuleLoaderService#loadOnFirstRequest()`) and delegate to its
`AccountService` / `TransactionService` / `AccountantService`. `settings.json` reads the resident `BANK_CONFIG` and
does not load the module. The specs (`docs/agents/specs/banking/accounts/regular.md`,
`debt.md`, `transactions.md`) are the source of truth for the behaviour.

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

- `account_number` is masked (`•••• ` + last 4 characters) in every response (the list and the
  create, update, archive and unarchive responses) except the detail response
  (`GET <base>/accounts/:accountId.json`), which returns it in full.
- `balance` (current balance) = `opening_balance` + SUM(transactions dated on or after
  `opening_date`); on the list it comes from one grouped query.
- Each account type adds its nested object under its type name; `regular` has none, `debt`
  carries a `debt` object (see [Debt object](#debt-object)), `investment` carries an
  `investment` object (see [Investment object](#investment-object)), and `provider_expense`
  carries a `provider_expense` object (see [Provider-expense object](#provider-expense-object)). Sending another type's nested object (e.g.
  `debt` on a regular account) → `400`.

## Accounts

| Method | Route | Body | Success | Errors | Cache class |
|---|---|---|---|---|---|
| GET | `<base>/accounts.json?type=regular&archived=false` | — | `200` list of accounts of that `type` (`regular` default, `debt`, `investment`, `provider_expense`), sorted by name; `archived=true` also lists archived ones (with `archived_at` set) | `400` type without a handler, invalid `archived` | `user-scoped` |
| POST | `<base>/accounts.json` | `CreateAccountDto` | `201` account | `400` validation / type without a handler / wrong nested object / non-zero `opening_balance` on an investment; `409 ACCOUNT_NAME_TAKEN` | `never` |
| GET | `<base>/accounts/:accountId.json` | — | `200` account (full number) | `404` | `user-scoped` |
| PATCH | `<base>/accounts/:accountId.json` | `UpdateAccountDto` | `200` account | `400`; `404`; `409 ACCOUNT_ARCHIVED` (anything but `name` on an archived account), `CURRENCY_LOCKED` (currency change once the account has transactions), `ACCOUNT_NAME_TAKEN` | `never` |
| DELETE | `<base>/accounts/:accountId.json` | — | `204` | `404`; `409 ACCOUNT_HAS_TRANSACTIONS` (message points to archive; also on the FK race) | `never` |
| POST | `<base>/accounts/:accountId/archive.json` | — | `200` account (idempotent) | `404` | `never` |
| POST | `<base>/accounts/:accountId/unarchive.json` | — | `200` account (idempotent) | `404`; `409 ACCOUNT_NAME_TAKEN` | `never` |

`CreateAccountDto`:

| Field | Rule |
|---|---|
| `type` | Optional, default `regular`; `regular`, `debt`, `investment` and `provider_expense` have handlers; any other type → `400` |
| `debt` | Optional, only with `type: debt` (see [Debt object](#debt-object)) |
| `investment` | Optional, only with `type: investment` (see [Investment object](#investment-object)) |
| `provider_expense` | Optional, only with `type: provider_expense` (see [Provider-expense object](#provider-expense-object)) |
| `name` | Required; trimmed, non-blank, at most 255 characters; unique per owner among active accounts, case-insensitively (accent-sensitive) |
| `bank_name`, `branch`, `account_number` | Optional, at most 64 characters; trimmed, blank → `null` |
| `currency` | Optional ISO 4217 code from `Intl.supportedValuesOf('currency')`; defaults to `BANK_DEFAULT_CURRENCY` |
| `opening_date` | Optional, defaults to UTC today |
| `opening_balance` | Optional decimal string, default `"0"`; must be `0` on an investment account (`400` otherwise) |
| `notes` | Optional, at most 2000 characters |

`UpdateAccountDto` has the same fields except `type` (sending it → `400`), all optional;
`null` clears an optional field. Changing `currency` before any transaction keeps the opening
balance's decimal value (`400` when it cannot be represented in the new exponent).

### Debt object

`type: debt` accounts carry a nested `debt` object, stored 1:1 in `bank_debt_details`; the
spec is `docs/agents/specs/banking/accounts/debt.md`.

```json
"debt": {
  "interest_rate": "1.99", "interest_period": "monthly", "instalment_amount": "500.00",
  "instalment_frequency": "monthly", "due_day": 10, "due_month": null, "instalment_count": 24
}
```

- Present on list rows, the detail and the create / update / archive / unarchive responses of
  debt accounts; absent on other types. Unset fields are `null`; `interest_rate` is returned
  without trailing zeros. Loaded with one query per type on the list (no N+1).
- **Create** — optional; without it a row is still created (all fields `null`,
  `instalment_frequency` `monthly`).
- **PATCH** — merged partially (omitted fields unchanged, `null` clears); the paired rules
  below are checked on the stored details with the request merged on top. `yearly` →
  `monthly` clears `due_month`. A currency change rescales the stored `instalment_amount` like
  `opening_balance` (`400` when it cannot be represented).
- **`400`** — `debt: null`, unknown fields inside it, `debt` on a non-debt account;
  `interest_rate` without `interest_period` (or the reverse); `due_month` missing with
  `yearly` or set with `monthly`; `due_day` outside 1–31, `due_month` outside 1–12,
  `instalment_count` outside 1–2147483647; `instalment_amount` ≤ 0, over the amount bound or with too many
  decimals; `interest_rate` outside 0–100 or with more than 4 decimals.
- **`409 ACCOUNT_ARCHIVED`** — any `debt` field on an archived debt (a field failing the
  format checks above is still a `400`, rejected by the validation pipe first).

### Investment object

`type: investment` accounts carry a nested `investment` object, stored 1:1 in
`bank_investment_details`; the spec is `docs/agents/specs/banking/accounts/investment.md`.

```json
"investment": {
  "kind": "fixed_income", "yield_rate": "12.5", "yield_period": "yearly",
  "maturity_date": "2028-01-15", "liquidity_days": 0
}
```

- Present on list rows, the detail and the create / update / archive / unarchive responses of
  investment accounts; absent on other types. Unset fields are `null`; `yield_rate` is returned
  without trailing zeros. Loaded with one query per type on the list (no N+1).
- **Create** — optional; without it a row is still created (all fields `null`).
- **Opening balance** — always `0`: a non-zero `opening_balance` on create or PATCH → `400`
  (an account-level rule, enforced by the handler's account hook).
- **PATCH** — merged partially (omitted fields unchanged, `null` clears); the paired
  `yield_rate` ↔ `yield_period` rule is checked on the stored details with the request merged
  on top. The rate is cleared by sending both `null`.
- **`400`** — `investment: null`, unknown fields inside it, `investment` on a non-investment
  account; `yield_rate` without `yield_period` (or the reverse); `kind` not one of
  `fixed_income`, `fund`, `stocks`, `savings`, `pension`, `crypto`, `other`; `yield_period` not
  `monthly` / `yearly`; `yield_rate` outside 0–100 or with more than 4 decimals;
  `liquidity_days` not an integer in 0–2147483647; `maturity_date` not a real `YYYY-MM-DD`
  date (any past or future date is accepted).
- **`409 ACCOUNT_ARCHIVED`** — any `investment` field on an archived investment (a field
  failing the format checks above is still a `400`, rejected by the validation pipe first).

### Provider-expense object

`type: provider_expense` accounts carry a nested `provider_expense` object, stored 1:1 in
`bank_provider_expense_details`; the spec is
`docs/agents/specs/banking/accounts/provider-expense.md`. Charges and payments use the generic
transaction routes unchanged.

```json
"provider_expense": {
  "for_accountant": true, "provider_tax_id": "12.345.678/0001-90", "expected_amount": "149.90",
  "charge_frequency": "monthly", "due_day": 10, "due_month": null
}
```

- Present on list rows, the detail and the create / update / archive / unarchive responses of
  provider-expense accounts; absent on other types. Unset fields are `null`;
  `expected_amount` is a decimal string in the account's currency exponent. Loaded with one
  query per type on the list (no N+1).
- **Create** — optional; without it a row is still created (`for_accountant` `true`,
  `charge_frequency` `monthly`, every other field `null`). The paired rule below applies to
  the defaults with the request merged on top.
- **PATCH** — merged partially (omitted fields unchanged, `null` clears); the paired
  `charge_frequency` ↔ `due_month` rule is checked on the stored details with the request
  merged on top. Switching to `monthly` clears `due_month` automatically; switching to
  `yearly` requires a `due_month` (stored or sent).
- **Currency change** (only before any transaction) — rescales the stored `expected_amount`
  like `opening_balance` (`200.00` BRL → `200` JPY; `12.50` BRL → JPY → `400`), unless the
  same PATCH sends `expected_amount`, which is then validated against the new currency.
- **`provider_tax_id`** — free text, trimmed, blank → `null`, at most 32 characters, no
  format check.
- **`400`** — `provider_expense: null`, unknown fields inside it, `provider_expense` on another
  type; `for_accountant` / `charge_frequency` `null` (not nullable); `charge_frequency` not
  `monthly` / `yearly`; `due_month` missing when yearly or present when monthly (merged
  state); `due_day` outside 1–31, `due_month` outside 1–12; `expected_amount` ≤ 0, over the
  amount bound or with too many decimals for the currency; `provider_tax_id` over 32.
- **`409 ACCOUNT_ARCHIVED`** — any `provider_expense` field on an archived provider-expense
  account (a field failing the format checks above is still a `400`, rejected by the
  validation pipe first).
- The accountant hand-off (`sent_to_accountant_at`, preview, mark sent / unsent) is described
  in [Accountant hand-off](#accountant-hand-off).

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

- **`sent_to_accountant_at`** — present **only** on a charge (negative amount) of a
  `provider_expense` account: the ISO timestamp of the accountant hand-off mark, or `null` when
  unsent. On payments of provider-expense accounts and on every transaction of other account
  types the key is **absent** (not `null`), so those responses are unchanged. The same rule
  applies to the ledger rows (never on the virtual opening row).
- The body never accepts `sent_to_accountant_at` / `sentToAccountantAt` (`400`); the mark is
  set and cleared only by the [hand-off routes](#accountant-hand-off). A PATCH keeps the mark,
  except one that turns a sent charge positive (a payment), which clears it; flipping it back
  yields an unsent charge.

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
- Rows of provider-expense **charges** also carry `sent_to_accountant_at` (ISO timestamp or
  `null`); the key is absent on every other row and on `opening` (see
  [Transactions](#transactions)).
- `balance` is the running balance, computed with a window function over the account's whole
  ledger before the `LIMIT`, so it is correct across pages.
- `opening` is the virtual opening row (`opening_balance` − SUM(transactions dated before
  `opening_date`); its `balance` equals its `amount`). It is set only on the last page and is
  `null` on every other page.
- `page` defaults to `1`; a non-numeric or `< 1` page → `400`. A page past the last answers
  `transactions: []` and `opening: null` with the same metadata. `total_pages` is at least 1, so
  an empty ledger has one page holding the opening row.

## Accountant hand-off

Served by `AccountantController`, delegating to the lazy `AccountantService`; the spec is
`docs/agents/specs/banking/accounts/provider-expense.md` (*Business expenses for the
accountant*). There is no CSV route: the CSV is built client-side from the preview.

| Method | Route | Body | Success | Errors | Cache class |
|---|---|---|---|---|---|
| GET | `<base>/accountant/charges.json?from=&to=&include_sent=false` | — | `200 { charges: [...] }` | `400 VALIDATION_FAILED`; `404` non-member `:orgId` | `user-scoped` |
| POST | `<base>/accountant/mark-sent.json` | `{ "transaction_ids": [...] }` | `200 { charges: [...] }` | `400 VALIDATION_FAILED`; `404` | `never` |
| POST | `<base>/accountant/mark-unsent.json` | `{ "transaction_ids": [...] }` | `200 { charges: [...] }` | `400 VALIDATION_FAILED`; `404` | `never` |

### Preview

Lists the **charges** (negative amounts, never payments) of every `for_accountant`
provider-expense account of the active owner (archived accounts included, charges dated before
`opening_date` included) dated in `[from, to]`, ordered by date then id.

- **`from` / `to`** — required `YYYY-MM-DD` dates, each not after UTC today + 1 day; `from`
  after `to` → `400`; `from == to` (one day) is allowed; `to − from` at most **366** days.
- **`include_sent`** — optional `true` / `false` (default `false`: unsent charges only); any
  other value → `400`.
- A repeated parameter → `400`; unknown parameters are ignored.
- **Cap** — more than **1000** charges → `400` ("narrow the range"), never a partial list. An
  empty range answers `{ "charges": [] }`.

```json
{
  "charges": [
    {
      "id": 7, "date": "2026-10-05", "description": "Charge", "amount": "-129.90",
      "sent_to_accountant_at": null,
      "account": { "id": 12, "name": "Vivo Fibra", "bank_name": "Vivo",
                   "provider_tax_id": "02.558.157/0001-62", "currency": "BRL" }
    }
  ]
}
```

`amount` is in the row's own currency exponent (currencies may be mixed); `account` carries only
those five fields (no owner fields, no `account_number`, no balance).

### Mark sent / unsent

- **Body** (`@StrictBody()`) — `transaction_ids`: 1 to **1000** positive integers; an empty
  list, more than 1000 ids, a non-positive-integer entry or any other field → `400`. Duplicates
  are de-duplicated.
- **All-or-nothing** — the ids are resolved in one owner-scoped query that locks their
  `bank_transactions` rows (`SELECT … FOR UPDATE OF t`) inside one DB transaction:
  - any unknown, other owner's or wrong-context id → the uniform `404` (checked first, so a
    request mixing `404` and `400` ids answers `404`);
  - `mark-sent`: a payment, a charge of a `for_accountant`-off account or any transaction of
    another account type → `400 VALIDATION_FAILED` naming the rejected ids
    (e.g. "transactions 7, 9 are not hand-off charges");
  - `mark-unsent`: a payment or another account type → `400`; charges of a
    `for_accountant`-off account can still be un-marked;
  - nothing is stamped or cleared on any error.
- **Archived accounts** — marking is allowed (hand-off metadata, not a ledger edit), while
  transaction create / edit / delete there stay `409 ACCOUNT_ARCHIVED`.
- **Reply** — `200` with every posted id (de-duplicated) and its resulting mark:

  ```json
  { "charges": [ { "id": 7, "sent_to_accountant_at": "2026-11-09T12:00:00.000Z" } ] }
  ```

  `mark-sent` is idempotent: an already-sent charge keeps (and reports) its original
  timestamp. `mark-unsent` reports `null` for every id; an already-unsent charge is a no-op.

## Settings

| Method | Route | Success | Errors | Cache class |
|---|---|---|---|---|
| GET | `<base>/settings.json` | `200 { "default_currency": "BRL" }` from `BANK_DEFAULT_CURRENCY` (same value under both prefixes) | `404` non-member `:orgId` | `user-scoped` |
