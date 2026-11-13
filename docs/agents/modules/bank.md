# Module — Bank

Ward's first domain module, in the **lazy** tier (see
[Modular Pattern](../architecture/modular-pattern.md#module-classification)), table prefix
`bank_`, code in `backend/src/bank/` and `frontend/assets/js/components/resources/bank/`. It
tracks:

- bank accounts and their ledgers;
- business expenses, handed to the accountant;
- bills to pay.

Bank data is **user-or-organization-owned**: every record belongs to exactly one owner, the
user (Personal) or an organization (see
[Organizations → Data ownership](auth/organizations.md#data-ownership)). Built by Epic
[#26](https://github.com/darthjee/ward/issues/26): backend
[#48](https://github.com/darthjee/ward/issues/48), [#50](https://github.com/darthjee/ward/issues/50),
[#52](https://github.com/darthjee/ward/issues/52), [#54](https://github.com/darthjee/ward/issues/54),
[#71](https://github.com/darthjee/ward/issues/71), [#56](https://github.com/darthjee/ward/issues/56);
frontend [#49](https://github.com/darthjee/ward/issues/49), [#51](https://github.com/darthjee/ward/issues/51),
[#53](https://github.com/darthjee/ward/issues/53), [#55](https://github.com/darthjee/ward/issues/55),
[#57](https://github.com/darthjee/ward/issues/57) and [#77](https://github.com/darthjee/ward/issues/77)
(Calendar views, still open).

## Index

| Page | Concern |
|---|---|
| [bank/accounts.md](bank/accounts.md) | Common account fields, name uniqueness, archive vs delete, regular accounts, data sensitivity |
| [bank/transactions.md](bank/transactions.md) | Ledger, opening anchor, computed balances, `Transaction`, currency, categories, settings |
| [bank/debt.md](bank/debt.md) | Debt accounts: fields, sign rules, payments and interest, instalments as bills |
| [bank/investment.md](bank/investment.md) | Investment accounts: ledger as current value, movements, informational fields |
| [bank/provider-expense.md](bank/provider-expense.md) | Provider-expense accounts: payable ledger, provider fields, the accountant hand-off |
| [bank/bills.md](bank/bills.md) | Hybrid bill model, schedule fields, recurrence, paying / skipping / undoing |
| [bank/ui.md](bank/ui.md) | The Bank menu, per-type submenus, Add / edit bill, Bill history, Calendar |

The per-endpoint reference is [Routes — Bank](../backend/routes/bank.md).

## Entities

| Entity | Table | Notes |
|---|---|---|
| `Account` | `bank_accounts` | Every kind of account, with a `type`; the only table that stores the owner |
| `Transaction` | `bank_transactions` | The ledger rows of an account; FK `account_id` `ON DELETE RESTRICT` |
| `DebtDetails` | `bank_debt_details` | 1:1 with a `debt` account (`account_id` PK and FK, `ON DELETE CASCADE`) |
| `InvestmentDetails` | `bank_investment_details` | 1:1 with an `investment` account, same pattern |
| `ProviderExpenseDetails` | `bank_provider_expense_details` | 1:1 with a `provider_expense` account, same pattern |
| `Bill` | `bank_bills` | One-off bills, always on a provider-expense account |
| `BillPayment` | `bank_bill_payments` | One row per paid or skipped occurrence |

Every FK between these tables is real (same module). Column detail lives in each concern page.

## Account types

| `type` | Meaning | Page |
|---|---|---|
| `regular` | An everyday bank account | [accounts.md](bank/accounts.md#regular-accounts) |
| `debt` | A loan being paid off | [debt.md](bank/debt.md) |
| `investment` | One investment | [investment.md](bank/investment.md) |
| `provider_expense` | Charges and payments with one provider, including business expenses for the accountant | [provider-expense.md](bank/provider-expense.md) |

- `type` is fixed at creation; type-specific fields live in the 1:1 details table and travel as
  a nested object named after the type (`debt`, `investment`, `provider_expense`).
- **The main Accounts list shows `regular` accounts only.** Each other type has its own submenu
  (Debts, Investments, Providers; see [ui.md](bank/ui.md)).
- Every type carries the same ledger (see [transactions.md](bank/transactions.md)).

## Bank ownership contract

- **Only `bank_accounts` stores the owner**: `user_id` and `organization_id` (entity properties
  `userId` / `organizationId`), both nullable, **logical** references to `auth` (no physical
  FK). A DB **check constraint** requires exactly one of them to be set.
- **Owner lookup indexes** — the two unique active-name indexes
  `(user_id, active_name_key)` and `(organization_id, active_name_key)` double as the owner
  indexes (see [accounts.md](bank/accounts.md#name-uniqueness)).
- **Child records** (transactions, the three details tables, `bank_bills`,
  `bank_bill_payments`) **inherit the owner through their account** and never store a copy.
- **Route prefixes** — every bank controller is declared with
  `@OwnerScopedController('bank')`, so it is mounted under both:
  - personal: backend `/bank/...`, UI `#/bank/...`;
  - organization: backend `/orgs/:orgId/bank/...`, UI `#/orgs/:orgId/bank/...`.

  The proxy adds the external `/api` prefix (`/api/bank/accounts.json`). Both prefixes serve the
  same logic; the owner comes from the route through `OwnerContextGuard` (see
  [Organizations → Owner-context mechanism](auth/organizations.md#owner-context-mechanism)).
- **Account-name uniqueness is per owner**: the same name in Personal and in an organization (or
  in two organizations) is allowed.
- **Same owner only** — money moving between a personal and an organization account takes two
  manual transactions, and a bill's paying account must have the bill's owner.
- Responses **never** contain `user_id` / `organization_id`. A wrong context (an organization
  account on a personal route, or the reverse) answers **404**, like an unknown id.
- **Permissions** — in Personal, only the owner; in an organization, every member can do
  everything (roles are stored but not enforced, see
  [Organizations → Roles](auth/organizations.md#roles)).

Deferred: moving an account between owners
([#93](https://github.com/darthjee/ward/issues/93)) and sharing a personal record with an
organization ([#94](https://github.com/darthjee/ward/issues/94)).

## Routes

See [Routes — Bank](../backend/routes/bank.md). Seven thin resident controllers
(`AccountsController`, `TransactionsController`, `SettingsController`,
`AccountantController`, `CalendarController`, `BillsController`, `BillPaymentsController`)
load the lazy `BankModule` on the first bank request and delegate to its services.
`settings.json` reads the resident `BANK_CONFIG` and does not load the module.

## Cache classes

Every bank route is `user-scoped` or `never`, and sends `X-Skip-Cache`:

- `GET` routes are `user-scoped` (`Cache-Control: private, no-store`);
- writes are `never`.

Personal routes carry no owner in the URL, so a shared cache would leak data between users:
no bank route may ever be `public`. None goes into Navi's warm-up.

## Module shape

- **Resident part** — the controllers, the entity classes and the boot-validated
  `BANK_DEFAULT_CURRENCY` config (`bank-config.module.ts`). Nest registers routes only at boot,
  and `autoLoadEntities` only sees entities registered before the `DataSource` starts.
- **Lazy part** — `BankModule`: every service, query and piece of business logic, loaded by
  `BankModuleLoader` through `LazyModuleLoaderService#loadOnFirstRequest()`.
- **Dependencies** — only `auth`, through `OwnerContextGuard` and its DI port. `bank` never
  imports `auth` nor queries membership tables.
- **No events** emitted or consumed. Paying a bill is an in-module service call in one DB
  transaction.
- **Memory** — no idle cost (lazy) and no heavy dependency: currency data comes from the
  built-in `Intl`, the accountant CSV is built in the browser.

## Differences from the original spec

- Backend routes have no `/api` prefix (the proxy adds it); the specs wrote `/api/bank/...`.
- The owner lookup indexes are the two unique active-name indexes, not separate indexes.
- Page-specific differences are listed at the end of each concern page.
