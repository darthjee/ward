# Routes — Bank

Routes of the lazy `bank` module (`backend/src/bank/`), served by nine thin resident
controllers: `AccountsController`, `TransactionsController`, `SettingsController`,
`AccountantController`, `CalendarController`, `BillsController`, `BillPaymentsController`,
`ProviderBillsController` and `ProviderBillPaymentsController`. Each is
declared with `@OwnerScopedController('bank')`, so every route is mounted under **both** base
paths (the external `/api` prefix is added by the proxy):

- **`<base>`** — `/bank` (personal: the owner is the JWT user) or `/orgs/:orgId/bank`
  (organization: the owner is `:orgId`, after `OwnerContextGuard`'s membership check).

The controllers parse the ids, load the lazy `BankModule` on the first bank request
(`BankModuleLoader` → `LazyModuleLoaderService#loadOnFirstRequest()`) and delegate to its
`AccountService` / `TransactionService` / `AccountantService` / `CalendarService` /
`BillService` / `BillPaymentService` / `BillHistoryService` / `ProviderBillService` /
`ProviderBillPaymentService` (provider bills resolve owner-scoped through
`ProviderBillResolver`; default paying accounts go through `PayingAccountResolver`). `settings.json` reads the
resident `BANK_CONFIG` and does not load the module. The rules behind these routes (ownership,
ledger, currency, account types, the accountant hand-off, bills) are in the
[Bank module](../../modules/bank.md) and its `modules/bank/` pages; this page is the
per-endpoint reference.

## Shared rules

- **JWT-protected** (no `@Public()`), `.json` suffix, `snake_case` bodies.
- **Owner from the route only** — bodies are read only through `@StrictBody()`, so unknown
  fields, owner fields (`user_id`, `organization_id`, `userId`, `organizationId`), ids
  (`account_id`, `accountId`) and computed fields (`balance`) answer `400 VALIDATION_FAILED`.
  Responses never contain owner fields.
- **404 before 403** — every miss answers the same body
  (`{ error: { code: 'NOT_FOUND', message: 'Not Found' }, statusCode: 404, timestamp }`): an
  unknown or non-numeric id (ids go through `parseId`, never `ParseIntPipe`), another user's
  personal account, another organization's account, the wrong context (an organization account
  on a personal route, or the reverse), a transaction of another account, a non-member `:orgId`,
  and a global admin who is not a member (no admin bypass). A **member whose role is too low**
  gets the uniform `403` (`{ error: { code: 'FORBIDDEN', message: 'Forbidden' }, statusCode:
  403, timestamp }`), only after the membership is resolved, so a `403` never discloses anything
  to a non-member. See [Minimum role](#minimum-role).
- **Caching** — `GET` routes are `user-scoped` (`X-Cache-Allow: true`,
  `Cache-Control: private, no-store`; cached per caller by the proxy); writes are `never` (`X-Skip-Cache: true`,
  `Cache-Control: no-store`). None goes into Navi's warm-up.
- **Amounts** are decimal strings in the account currency's exponent (BRL/USD 2, JPY 0,
  BHD 3; e.g. `"-1234.56"`, `"500"`), stored as `BIGINT` minor units. More decimals than the
  currency allows, or `|amount|` over 10¹³ minor units → `400`.
- **Dates** are `YYYY-MM-DD`, never after UTC today + 1 day.
- **Bodies are never logged** (only method, route and status).

## Minimum role

Every write route declares its minimum organization role with `@MinOrgRole`, enforced by
`OwnerContextGuard` (see [Organizations → Roles](../../modules/auth/organizations.md#roles)).
The same rule applies under both base paths; the personal context counts as `owner`, so it
passes every check. Every `GET` is open to every member, and nothing needs `owner`.

| Method | Path (after `<base>/`) | Min role |
|---|---|---|
| POST | `accounts.json` | `admin` |
| PATCH / DELETE | `accounts/:accountId.json` | `admin` |
| POST | `accounts/:accountId/archive.json`, `accounts/:accountId/unarchive.json` | `admin` |
| POST | `accounts/:accountId/transactions.json` | `user` |
| PATCH | `accounts/:accountId/transactions/:transactionId.json` | `user` (`admin` if payment-generated) |
| DELETE | `accounts/:accountId/transactions/:transactionId.json` | `admin` |
| POST / PATCH | `bills.json`, `bills/:id.json` | `user` |
| DELETE | `bills/:id.json` | `admin` |
| POST | `accounts/:accountId/occurrences/:dueDate/payment.json`, `bills/:id/payment.json` | `user` |
| DELETE | `accounts/:accountId/occurrences/:dueDate/payment.json`, `bills/:id/payment.json` | `admin` |
| POST | `accounts/:accountId/provider-bills.json` | `user` |
| PATCH | `provider-bills/:id.json` | `user` |
| DELETE | `provider-bills/:id.json` | `admin` |
| POST | `provider-bills/:id/occurrences/:dueDate/payment.json` | `user` |
| DELETE | `provider-bills/:id/occurrences/:dueDate/payment.json` | `admin` |
| POST | `accountant/mark-sent.json`, `accountant/mark-unsent.json` | `user` |

The pattern: everyday writes (transactions, bills, pay / skip, accountant marks) need `user`;
every `DELETE` (undoing a payment included) and every account-structure write need `admin`.

**Payment-generated transactions** — a `PATCH` on a transaction referenced by a bill payment
(its payment, withdrawal or charge transaction) needs `admin`. This depends on the record, so it
is checked in `TransactionService` (`PaymentGeneratedQuery`), not by the decorator, and answers
the same uniform `403`.

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
| GET | `<base>/accounts.json?type=regular&archived=false` | — | `200` list of accounts of that `type` (`regular` default, `debt`, `investment`, `provider_expense`), sorted by name; `archived=true` also lists archived ones (with `archived_at` set); `provider_expense` rows also carry `bills_summary` (see [Provider-expense object](#provider-expense-object)) | `400` type without a handler, invalid `archived` | `user-scoped` |
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
rules are in [Bank — Debt accounts](../../modules/bank/debt.md).

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

- **Schedule fields** (bills, see [Bank — Bills](../../modules/bank/bills.md#schedule-fields)) — the object also
  accepts `bills_from` (`YYYY-MM-DD` or `null`), `show_in_calendar` (boolean, not nullable,
  default `true`) and `paying_account_id` (positive integer or `null`), and returns
  `bills_from`, `show_in_calendar` and `paying_account: { id, name } | null` (never the raw
  id). Setting `due_day` for the first time while `bills_from` is `null` and not sent sets
  `bills_from` to UTC today; clearing `due_day` keeps it. A `paying_account_id` that is
  unknown, another owner's, in the other context, not `regular` or archived → `422
  ACCOUNT_NOT_FOUND` (one generic body); a visible account of another currency → `422
  CURRENCY_MISMATCH`. A currency-changing account PATCH re-checks the stored default.
- **`bills_summary`** (list only, [#133](https://github.com/darthjee/ward/issues/133)) — every
  `provider_expense` row of `GET <base>/accounts.json` (active and archived) carries a
  top-level field:

  ```json
  "bills_summary": { "count": 3, "monthly": "250.00", "yearly": "1200.00" }
  ```

  - `count` (number): every bill of the provider, recurring and one-off;
  - `monthly` / `yearly`: the sum of `expected_amount` over `kind = 'recurring'` bills with that
    `charge_frequency`, as a decimal string in the provider's currency; one-offs and bills with
    a `null` `expected_amount` are excluded;
  - never `null`: nothing to sum is zero at the currency's exponent (`"0.00"` in BRL, `"0"` in
    JPY); a provider with no bills gets `{ "count": 0, "monthly": "0.00", "yearly": "0.00" }`;
  - list only: absent on `accounts/:accountId.json`, on write responses and on other account
    types; aggregates only, never owner ids;
  - computed in one grouped query over all listed providers (no N+1);
  - cache: the list stays `user-scoped`; provider-bill writes invalidate the owner prefix, which
    covers `accounts.json`.

### Investment object

`type: investment` accounts carry a nested `investment` object, stored 1:1 in
`bank_investment_details`; the rules are in
[Bank — Investment accounts](../../modules/bank/investment.md).

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
`bank_provider_expense_details`; the rules are in
[Bank — Provider-expense accounts](../../modules/bank/provider-expense.md). Charges and payments use the generic
transaction routes unchanged.

```json
"provider_expense": { "for_accountant": true, "provider_tax_id": "12.345.678/0001-90" }
```

- Present on list rows, the detail and the create / update / archive / unarchive responses of
  provider-expense accounts; absent on other types. Loaded with one query per type on the list
  (no N+1). Since [#125](https://github.com/darthjee/ward/issues/125) the provider carries no
  schedule: the former schedule keys (`expected_amount`, `charge_frequency`, `due_day`,
  `due_month`, `bills_from`, `show_in_calendar`, `paying_account`) are **absent**. The schedule
  lives on each provider bill (see [Provider bills](#provider-bills)).
- **Create** — optional; without it a row is still created (`for_accountant` `true`,
  `provider_tax_id` `null`).
- **PATCH** — merged partially (omitted fields unchanged, `null` clears `provider_tax_id`).
- **Currency change** (only before any transaction) — rescales the provider's bills'
  `expected_amount` like `opening_balance` (`200.00` BRL → `200` JPY; `12.50` BRL → JPY →
  `400`).
- **`provider_tax_id`** — free text, trimmed, blank → `null`, at most 32 characters, no
  format check.
- **`400`** — `provider_expense: null`, unknown fields inside it (**including any former
  schedule field**, e.g. `provider_expense.due_day`), `provider_expense` on another type;
  `for_accountant` `null` (not nullable); `provider_tax_id` over 32.
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

Served by `AccountantController`, delegating to the lazy `AccountantService`; the rules are in
[Bank — Provider-expense accounts → Accountant hand-off](../../modules/bank/provider-expense.md#accountant-hand-off). There is no CSV route: the CSV is built client-side from the preview.

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

## Bills and calendar

Served by `CalendarController`, `BillsController` and `BillPaymentsController`, delegating to
the lazy `CalendarService`, `BillService`, `BillPaymentService` and `BillHistoryService`; the
rules are in [Bank — Bills](../../modules/bank/bills.md). Occurrences are computed in memory per request
(pure `occurrence-generator.ts`: monthly / yearly, `bills_from` start, clamp to the month's last
day, Saturday / Sunday → Monday); nothing is generated ahead of time. Tables:
`bank_provider_bills` (here, the one-off bills) and `bank_bill_payments`.

| Method | Route | Body | Success | Errors | Cache class |
|---|---|---|---|---|---|
| GET | `<base>/calendar.json?from=&to=` | — | `200 { occurrences, totals }` | `400 VALIDATION_FAILED` (missing / invalid / repeated date, `from > to`, `to − from` over 366 days) | `user-scoped` |
| GET | `<base>/calendar/overdue.json` | — | `200 { occurrences, totals }`, oldest first | `404` non-member `:orgId` | `user-scoped` |
| GET | `<base>/bills.json?provider_account_id=&page=` | — | `200 { bills, pagination }` | `400` invalid `page` / malformed filter | `user-scoped` |
| POST | `<base>/bills.json` | bill body | `201` bill | `400`; `422 ACCOUNT_NOT_FOUND` / `CURRENCY_MISMATCH` | `never` |
| GET | `<base>/bills/:id.json` | — | `200` bill | `404` (also when the provider is archived) | `user-scoped` |
| PATCH | `<base>/bills/:id.json` | bill body, all optional | `200` bill | `400`; `404` (also when the provider is archived); `422`; `409 BILL_PAID` (provider change on a paid bill) | `never` |
| DELETE | `<base>/bills/:id.json` | — | `204` (an unpaid / skipped bill goes with its payment row) | `404` (also when the provider is archived); `409 BILL_PAID` | `never` |
| POST | `<base>/accounts/:accountId/occurrences/:dueDate/payment.json` | payment body | `201` occurrence | `404`; `400`; `422`; `409 OCCURRENCE_ALREADY_PAID` | `never` |
| DELETE | `<base>/accounts/:accountId/occurrences/:dueDate/payment.json` | — | `204` | `404`; `409 ACCOUNT_ARCHIVED` | `never` |
| POST | `<base>/bills/:id/payment.json` | payment body | `201` occurrence (`kind: bill`) | `404`; `400`; `422`; `409 OCCURRENCE_ALREADY_PAID` | `never` |
| DELETE | `<base>/bills/:id/payment.json` | — | `204` | `404`; `409 ACCOUNT_ARCHIVED` | `never` |
| GET | `<base>/accounts/:accountId/bill-payments.json?page=` | — | `200 { payments, pagination }` | `400` invalid `page`; `404` (also for regular / investment accounts) | `user-scoped` |

The account-level `occurrences/:dueDate/payment.json` and `bill-payments.json` routes serve
**debt accounts only** since #125: a `provider_expense` account answers the same uniform `404`
as an unknown or foreign account. Providers are paid and listed per bill via
`<base>/provider-bills/:id/occurrences/:dueDate/payment.json` and
`<base>/provider-bills/:id/bill-payments.json` (see [Provider bills](#provider-bills)). The
`bills.json` and `bills/:id/payment.json` routes remain as the one-off compatibility projection
(they filter `kind = 'one_off'` and keep `amount`).

### Calendar envelope and totals

```json
{
  "occurrences": [
    {
      "kind": "provider_bill", "source_account": { "id": 12, "name": "Vivo Fibra", "type": "provider_expense" },
      "source_bill": { "id": 31, "description": "Internet" },
      "bill": null, "nominal_date": "2026-11-08", "effective_date": "2026-11-09",
      "expected_amount": "149.90", "currency": "BRL", "status": "open", "payment": null,
      "default_paying_account": { "id": 3, "name": "Nubank" }
    }
  ],
  "totals": [ { "currency": "BRL", "expected": "149.90", "paid": "0.00", "open": "149.90" } ]
}
```

- `kind` is the `OccurrenceKind`: `debt`, `provider_bill` (recurring provider bill) or `bill`
  (one-off); `provider_bill` was named `provider` until
  [#125](https://github.com/darthjee/ward/issues/125). `source_bill: { id, description }` is set
  for both provider kinds and `null` for debts; `notes` never appears. `status` is `open`, `overdue`, `paid` or `skipped`;
  `payment` is `{ id, status, paid_on, amount, paying_account: { id, name } | null }` or `null`.
- `calendar.json` lists the occurrences whose **effective** date is in `[from, to]`, sorted by
  `effective_date`, then `kind`, the source bill id, the source account id and the one-off bill
  id. `overdue.json` lists every
  open occurrence with an effective date before UTC today, oldest first.
- **Totals** — one entry per currency (sorted by code), never summed across currencies; an
  empty range answers `totals: []`. `calendar.json`: `{ currency, expected, paid, open }`
  (occurrences without an expected amount count toward neither `expected` nor `open`; skipped
  ones toward neither `paid` nor `open`). `overdue.json`: `{ currency, open }`.
- A schedule exists only when `due_day` and `bills_from` are set, `show_in_calendar` is `true`
  and the account is not archived; one-off bills of archived providers are hidden too.

### Bills

Bill body (`@StrictBody()`): `provider_account_id` (a `provider_expense` account), `paying_account_id`
(a `regular`, non-archived account of the provider's currency; `null` allowed on PATCH),
`due_date` (any date, no weekend shift), `amount` (> 0, provider's currency), `description`
(trimmed, at most 255), `notes` (at most 2000, nullable). All required on create except
`notes`. A bad account id in the body → `422 ACCOUNT_NOT_FOUND` (archived providers
included); a currency mismatch → `422 CURRENCY_MISMATCH`.

Bill response: `{ id, provider_account: { id, name }, paying_account: { id, name } | null,
due_date, amount, currency, description, notes, payment | null, created_at, updated_at }`.

- **List** — newest `due_date` first, then `id`; ledger `pagination` block (50 per page). The
  optional `provider_account_id` filter answers an empty list for an unknown, foreign or
  non-provider id (never `404`).
- **PATCH with a payment** — a provider change on a `paid` bill → `409 BILL_PAID`; otherwise
  the payment row follows the bill (source account and due date) in the same DB transaction. A
  provider change re-checks the paying account's currency and rescales the amount (`400` when
  it cannot be represented).

### Pay, skip and undo

Payment body (`@StrictBody()`): `status` (`paid` | `skipped`); for `paid` also `paid_on`
(at most UTC today + 1 day), `amount` (> 0), `paying_account_id` and `record_charge`
(providers and one-offs only, default `true`). Any extra field on a skip, or `record_charge` on
a debt → `400`. Check order: path `404`, body `400`, paying account `422`, then `409`.

- `:dueDate` is the **nominal** date (`YYYY-MM-DD`). A date that is not an occurrence
  (off-schedule, before `bills_from`, hidden or archived account) or, on the account-level
  route, a non-debt account (providers included since #125) → `404`.
- **`paid`** writes the `bank_bill_payments` row plus a payment (+) on the source account, a
  withdrawal (−) on the paying account and, with `record_charge`, an unsent charge (−) on the
  provider (it feeds the accountant hand-off), all dated `paid_on`, described
  `"<bill description | account name> — <nominal date>"` (label truncated so the total stays
  ≤ 255), in **one DB transaction**. **`skipped`** writes only the row.
- **Undo** — `204`; deletes the linked transactions that still exist (a charge already sent to
  the accountant included) and the row, in one DB transaction. No payment → `404`. A `paid`
  payment whose source or paying account is archived → `409 ACCOUNT_ARCHIVED`; a skip on an
  archived source, or a one-off whose provider is archived → `404`. Undo looks the row up with
  no schedule check, so off-schedule payments can be undone.

### Bill history

`bill-payments.json` lists the payment rows of a debt account (per bill for providers, see
[Provider bills](#provider-bills)), newest `due_date` first, then `id`, with the ledger
`pagination` block:

```json
{
  "payments": [ { "id": 4, "status": "paid", "paid_on": "2026-11-09", "amount": "149.90",
                  "paying_account": { "id": 3, "name": "Nubank" }, "due_date": "2026-11-08",
                  "bill": null, "source_bill": null, "off_schedule": false } ],
  "pagination": { "page": 1, "per_page": 50, "total_pages": 1, "total_count": 1 }
}
```

`off_schedule` is `true` when `due_date` is not a nominal occurrence of the account's current
schedule pattern (`due_day`, `due_month`, frequency, `bills_from`; archived and
`show_in_calendar` are ignored). An archived account's history stays readable.

## Settings

| Method | Route | Success | Errors | Cache class |
|---|---|---|---|---|
| GET | `<base>/settings.json` | `200 { "default_currency": "BRL" }` from `BANK_DEFAULT_CURRENCY` (same value under both prefixes) | `404` non-member `:orgId` | `user-scoped` |

## Provider bills

Served by `ProviderBillsController` and `ProviderBillPaymentsController`, delegating to the lazy
`ProviderBillService`, `ProviderBillPaymentService` and `BillHistoryService`; bills resolve
through `ProviderBillResolver`. The rules (kinds, validation matrix, payment keys, ownership)
are in [Bank — Bills → Provider bills](../../modules/bank/bills.md#provider-bills).

| Method | Route | Body | Success | Errors | Cache class |
|---|---|---|---|---|---|
| GET | `<base>/accounts/:accountId/provider-bills.json?kind=&page=` | — | `200 { provider_bills, pagination }` (archived provider allowed) | `400` invalid `page`; `404` | `user-scoped` |
| POST | `<base>/accounts/:accountId/provider-bills.json` | create body | `201` provider bill | `400`; `404`; `409 ACCOUNT_ARCHIVED`, `PROVIDER_BILL_NAME_TAKEN`, `PROVIDER_BILL_LIMIT`; `422` | `never` |
| GET | `<base>/provider-bills/:id.json` | — | `200` provider bill (archived provider allowed) | `404` | `user-scoped` |
| PATCH | `<base>/provider-bills/:id.json` | update body | `200` provider bill | `400`; `404` (also when the provider is archived); `409 PROVIDER_BILL_KIND_LOCKED`, `PROVIDER_BILL_PROVIDER_LOCKED`, `PROVIDER_BILL_NAME_TAKEN`, `PROVIDER_BILL_PAID` (moving a paid one-off), `ACCOUNT_ARCHIVED` (archived move target); `422` | `never` |
| DELETE | `<base>/provider-bills/:id.json` | — | `204` (skipped payment rows go with it) | `404` (also when the provider is archived); `409 PROVIDER_BILL_PAID` | `never` |
| GET | `<base>/provider-bills/:id/bill-payments.json?page=` | — | `200 { payments, pagination }`, that bill only (archived provider allowed) | `400` invalid `page`; `404` | `user-scoped` |
| POST | `<base>/provider-bills/:id/occurrences/:dueDate/payment.json` | payment body | `201` occurrence | `404`; `400`; `422`; `409 OCCURRENCE_ALREADY_PAID` | `never` |
| DELETE | `<base>/provider-bills/:id/occurrences/:dueDate/payment.json` | — | `204` | `404`; `409 ACCOUNT_ARCHIVED` (paid row on an archived provider or paying account) | `never` |

- **Create body** (`@StrictBody()`) — `kind` (required, `recurring` | `one_off`), `description`
  (required, trimmed, at most 255), and optionally `expected_amount` (decimal string, `> 0`),
  `paying_account_id`, `notes` (at most 2000), the recurring group (`charge_frequency`,
  `due_day`, `due_month`, `bills_from`, `show_in_calendar`) and `due_date`, following the
  [validation matrix](../../modules/bank/bills.md#kinds). The body never accepts `id`,
  `created_at` or an owner.
- **Update body** — the same fields, all optional (`null` clears), validated on the merged
  state, plus `kind` (accepted only when equal to the stored value, otherwise `409`) and
  `provider_account_id` (moves a one-off; a recurring bill → `409 PROVIDER_BILL_PROVIDER_LOCKED`,
  checked before the target is resolved).
- **Response** — `{ id, provider_account_id, kind, description, paying_account_id,
  expected_amount, notes, charge_frequency, due_day, due_month, bills_from, show_in_calendar,
  due_date, created_at, updated_at }`. `paying_account_id` is the raw id (not `{ id, name }`);
  `expected_amount` is a decimal string in the provider's currency or `null`. Never an owner or
  organization id. Full bill fields appear only on these routes.
- **List** — 50 per page (ledger `pagination` block): recurring bills first by `description`
  (case- and accent-insensitive, then `id`), then one-offs by newest `due_date`, then `id`.
  `kind` filters; an unknown value answers an empty list, never `400` / `404`.
- **History rows** — as in [Bill history](#bill-history); `source_bill` is set, `bill` only on
  one-off rows. `off_schedule` is computed against that bill's own schedule.
- **Payment body** — as in [Pay, skip and undo](#pay-skip-and-undo); `record_charge` is accepted
  for both kinds. Check order: path `404`, `:dueDate` `404`, body `400`, paying account `422`,
  then `409`. Paying writes the row keyed by `(provider_bill_id, due_date)` (one-offs by
  `bill_id`) and the same transactions as any provider payment; two bills of one provider pay on
  the same date independently. A bill with a `null` `expected_amount` needs an explicit amount.
- **`:dueDate`** — strictly parsed `YYYY-MM-DD` (impossible dates → `404`). **Pay / skip**: a real
  nominal occurrence of that bill (generator check for `recurring`, only inside the 366-day
  window and only while it has a schedule, `show_in_calendar` is `true` and the provider is
  active; equality with `due_date` for `one_off`), otherwise `404`. **Undo** finds the row with
  no schedule check, so off-schedule payments can be undone.
- **404** — the uniform body for an unknown, non-numeric, foreign, other-context or debt id.

### Error codes

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` / validation | Violation of the matrix; a field of the other group; bad `due_month` pairing; non-whitelisted field |
| 403 | `FORBIDDEN` | Uniform: the member's role is below the route's [minimum role](#minimum-role) (every `DELETE` needs `admin`) |
| 404 | `NOT_FOUND` | Uniform: unknown, foreign, other-context or debt id; malformed or not-an-occurrence `:dueDate`; a write on an archived provider's bill |
| 409 | `PROVIDER_BILL_KIND_LOCKED` | PATCH sends a different `kind` |
| 409 | `PROVIDER_BILL_PROVIDER_LOCKED` | PATCH moves a recurring bill to another provider |
| 409 | `PROVIDER_BILL_NAME_TAKEN` | Recurring `description` already used on the provider |
| 409 | `PROVIDER_BILL_PAID` | DELETE, or moving a one-off, with a paid payment |
| 409 | `PROVIDER_BILL_LIMIT` | 51st recurring bill on a provider |
| 409 | `ACCOUNT_ARCHIVED` | Create under an archived provider; archived move target; undo of a paid row on an archived account |
| 409 | `OCCURRENCE_ALREADY_PAID` | Paying or skipping an occurrence that already has a row |
| 422 | `ACCOUNT_NOT_FOUND` / `CURRENCY_MISMATCH` | `paying_account_id` (or a one-off's move target currency) fails the checks; generic body |

### Removed routes

[#125](https://github.com/darthjee/ward/issues/125) removed the provider-level schedule:

- the account-level provider aliases for pay / undo / history
  (`accounts/:accountId/occurrences/:dueDate/payment.json`, `accounts/:accountId/bill-payments.json`)
  now answer the uniform `404` for a `provider_expense` account; they remain for **debts only**;
- the former schedule keys on the `provider_expense` object now answer `400`;
- `409 PROVIDER_HAS_MULTIPLE_BILLS` no longer exists.

`bills.json`, `bills/:id.json` and `bills/:id/payment.json` remain, for **one-offs only**.

### Caching

- GETs are `user-scoped` (`X-Cache-Allow`), set by `@OwnerScopedController('bank')`.
- Writes are `never` (`@CachePolicy(CacheClass.Never)`, `X-Skip-Cache`), and the class-level
  `InvalidatesOwner()` clears `/bank` or `/orgs/:id/bank`, which covers `accounts.json`
  (`bills_summary`), the calendar, overdue and the history routes.
- Navi warms none of them. The proxy needs no change: the `*.json` rule covers these paths.
