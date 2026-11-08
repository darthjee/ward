# Regular accounts

> **Owned by [#29](https://github.com/darthjee/ward/issues/29).** This file defines regular
> accounts and the **fields and rules common to every account type**. The debt, investment and
> provider-expense files ([#30](https://github.com/darthjee/ward/issues/30)–[#32](https://github.com/darthjee/ward/issues/32))
> add only their type-specific fields and reuse everything here. The ledger, balances, currency
> and transactions are in [transactions.md](transactions.md).

## Summary

- A regular account is an `Account` with `type` `regular` (see [README.md](README.md)).
- It has exactly one owner — the user (Personal) or an organization — see the
  [Bank ownership contract](../README.md#bank-ownership-contract) and
  [auth/organizations.md](../../auth/organizations.md#data-ownership).
- Regular accounts are the only ones shown in the main **Accounts** list.
- A regular account always carries a ledger (see [transactions.md](transactions.md#ledger)).

## Common account fields

Shared by every account type (`bank_accounts` table). Each type's own file adds only its
specific fields.

| Field | Required | Editable | Notes |
|---|---|---|---|
| `id` | — | — | |
| `userId` | see notes | no | Nullable; set on personal routes from the JWT user. Exactly one of `userId` / `organizationId` is set (DB check constraint). Never from the request body, never returned |
| `organizationId` | see notes | no | Nullable; set on organization routes from the URL's `:orgId`. Exactly one of `userId` / `organizationId` is set (DB check constraint). Never from the request body, never returned |
| `type` | yes | no | `regular` / `debt` / `investment` / `provider_expense`; fixed after creation because type-specific fields hang off it |
| `name` | yes | yes | Trimmed, max 255 characters; **unique within its owner (Personal or an organization)**, case-insensitive, among non-archived accounts (see [Name uniqueness](#name-uniqueness)) |
| `bankName` | no | yes | Free text (no `Bank` catalogue entity) |
| `branch` | no | yes | Free text (bank branch / "agência"); optional because not every user wants to record it |
| `accountNumber` | no | yes | Free text (formats vary, check digits included); optional for the same reason. **Masked in lists** (e.g. `•••• 1234`), shown in full only on the detail page |
| `currency` | yes | see [Currency](transactions.md#currency) | ISO 4217 code |
| `archivedAt` | no | via archive / unarchive | `null` = active; see [Archive vs delete](#archive-vs-delete) |
| `notes` | no | yes | Free text |
| `createdAt` / `updatedAt` | — | — | |

- **Opening anchor** — `openingDate` and `openingBalance` are added to `Account` by
  [transactions.md](transactions.md#opening-balance-anchor-model) for every account type that
  carries a ledger (so always for `regular`).
- **Length limits** — `name` 255; `bank_name`, `branch`, `account_number` 64; `notes` 2000.
  Over the limit → **400**, never truncated.

## Name uniqueness

- A name is unique within its owner (Personal or an organization), **case-insensitively**,
  among **active** (non-archived) accounts of any type. Archived accounts' names are free. The
  same name in Personal and in an organization, or in two organizations, is allowed.
- **Enforced in the DB** — a generated column
  `active_name_key = IF(archived_at IS NULL, LOWER(name), NULL)` with **two unique indexes**:
  `(user_id, active_name_key)` for personal accounts and `(organization_id, active_name_key)`
  for organization accounts. NULLs never clash, so archived names never collide and each index
  ignores the other owner kind's rows (personal rows have `organization_id = NULL`, organization
  rows `user_id = NULL`); one index cannot cover both because MySQL has no partial indexes.
  These two indexes double as the owner lookup indexes the
  [Bank ownership contract](../README.md#bank-ownership-contract) requires.
- A duplicate-key error maps to **409** on create, rename and unarchive.

## Archive vs delete

Applies to every account type.

**Archive is the normal way to retire an account.**

- `archive` sets `archivedAt`; `unarchive` clears it.
- **Hidden by default** — the Accounts list shows active accounts only, with a *Show archived*
  toggle; archived rows are marked as such.
- **Still reachable** — the detail page and ledger keep working; history is never lost.
- **Read-only while archived** — no field edits and no transaction create / edit / delete. The
  only actions allowed are **unarchive** and **rename**.
- **Unarchive checks the name rule** — names are unique among active accounts, so unarchiving
  answers **409** when an active account already has that name; the user renames one of them
  first (renaming is allowed while archived for exactly this reason).

**Hard delete is only for mistakes.**

- An account can be hard-deleted **only when it has no transactions** (the opening anchor lives
  on the account and does not count).
- Otherwise delete answers **409**, with a message pointing to archive.
- **DB-enforced** — the real FK `bank_transactions.account_id → bank_accounts.id ON DELETE
  RESTRICT` makes the DB refuse deleting an account with transactions, which covers the race
  between the check and the delete (→ 409).
- Deleting an account with history (cascade) is **not provided**.

## Accounts submenu UI

The **Accounts** entry of the Bank menu (see [ui/menu.md](../ui/menu.md)). All pages live under
the active context, `<ui>/accounts…` (see [Routes and permissions](#routes-and-permissions) for
`<ui>`); links are built from the active context, so every page works in either context.

### List

`<ui>/accounts`

- `regular` accounts only. Columns: name, bank, masked account number (`•••• 1234`), currency,
  current balance (formatted with `Intl` in the account's own currency; **no grand total**,
  since currencies may differ).
- Sorted by name; no pagination.
- *Show archived* toggle (archived rows marked); **New account** button.
- Empty state: "No accounts yet" with a create button.
- A row opens the detail page.

### Detail

`<ui>/accounts/:accountId`

- Header: all fields (full account number) and the current balance.
- Actions: Edit, Archive / Unarchive, Delete (shown only when the account has no
  transactions). An archived account shows a banner and only **Unarchive** and **Rename**.
- **Ledger**: date, description, amount, running balance; **newest first**, the virtual opening
  row last; **paginated, 50 rows per page** (the running balance stays correct across pages).
  Ledger behaviour is defined in [transactions.md](transactions.md#ledger).
- **Transactions are added and edited inline**, in a form row at the top of the ledger;
  deleting asks for confirmation.

### Create / Edit

`<ui>/accounts/new`, `<ui>/accounts/:accountId/edit`

- Fields: name, bank, branch, account number, currency, opening date, opening balance, notes.
- Currency: searchable ISO select, defaulting to `BANK_DEFAULT_CURRENCY` (read from
  [`settings.json`](transactions.md#settings)); locked once the account has transactions.
- Opening date defaults to today, opening balance to 0.
- `type` is not shown — always `regular` from this submenu.

## Routes and permissions

All bank routes are JWT-protected and use the `.json` suffix. Following the
[Bank ownership contract](../README.md#bank-ownership-contract), they are served under **two
base paths**, defined once here and reused by every bank spec:

- **`<base>`** (API) — `/api/bank` (personal) or `/api/orgs/:orgId/bank` (organization);
- **`<ui>`** (UI) — `/bank` (personal) or `/orgs/:orgId/bank` (organization).

The same controllers serve both prefixes through **`@OwnerScoped()`**, with the same logic. The
route tables below are relative to `<base>`. The account routes are **generic for every account
type**; the transaction and settings routes are in [transactions.md](transactions.md#routes),
which reuses the [Rules](#rules) below.

### Accounts

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `/accounts.json?type=regular&archived=false` | List accounts; `type` defaults to `regular` (other types reuse the route once their spec defines them); `archived=true` includes archived ones | `user-scoped` |
| POST | `/accounts.json` | Create; only `type: regular` (default) is accepted until the other type specs exist, anything else → 400 | `never` |
| GET | `/accounts/:accountId.json` | Detail, with the full account number and the current balance | `user-scoped` |
| PATCH | `/accounts/:accountId.json` | Edit; `type` never accepted; `currency` only while the account has no transactions (else 409); on an archived account only `name` is accepted | `never` |
| DELETE | `/accounts/:accountId.json` | Hard delete; 409 when the account has transactions | `never` |
| POST | `/accounts/:accountId/archive.json` | Archive | `never` |
| POST | `/accounts/:accountId/unarchive.json` | Unarchive; 409 on a name clash | `never` |

- `POST` applies `BANK_DEFAULT_CURRENCY` when `currency` is omitted (see
  [Currency](transactions.md#currency)).
- The opening anchor (`opening_date`, `opening_balance`) is set on `POST` and edited through
  `PATCH` (see [transactions.md](transactions.md#opening-balance-anchor-model)).

### Rules

- **404, never 403** — every miss is a 404 with an identical body: an unknown or non-numeric
  id, another user's personal account, another organization's account, a non-member `:orgId`,
  and the **wrong context** (an organization account on a personal route, or the reverse).
- **Responses never contain owner fields** (`user_id`, `organization_id`).
- **The list masks `account_number` server-side** (`•••• 1234`); only the detail returns it in
  full, so the full number never travels when not needed.
- **Bodies never accept** `userId`, `organizationId`, `accountId`, `type` (on PATCH) or
  computed fields; the owner always comes from the route. Unknown fields are rejected by the
  whitelist `ValidationPipe`.
- **Permissions** — in Personal, only the owner. In an organization context, every member can
  do everything: roles are stored but not enforced (as in
  [#28](https://github.com/darthjee/ward/issues/28)). The permission-system
  epic adds the per-role matrix (see [Future epics](../README.md#future-epics)).
- **Caching** — `GET` routes are `user-scoped` (declared with `@CachePolicy`, sent with
  `X-Skip-Cache`); writes are `never`. Personal routes carry no owner in the URL, so they
  **must** stay `user-scoped` with `X-Skip-Cache`, no exception. None goes into Navi's warm-up.
- Responses are `snake_case`, as the organization routes.

## Data sensitivity & ownership

Accounts and ledgers are **financial data**. These rules apply to the whole `bank` module,
including [transactions.md](transactions.md).

- **Who sees and edits**:
  - **Personal** — only the owner, taken from the JWT, never from the URL or body. Personal data
    is never visible to organization members, even of an organization the owner belongs to.
  - **Organization** — only its members, all with equal rights while roles are not enforced.
  - Ward's global `is_admin` has access to neither (#28, #40). Every miss is a 404.
- **Never stored** — bank credentials, card numbers or CVVs; Ward never connects to banks (no
  open-banking / scraping). Stated explicitly so no later issue adds it silently.
- **Account number at rest** — **not encrypted**: it is not a credential, it is optional, and
  the DB connection is already over TLS ([#11](https://github.com/darthjee/ward/issues/11)).
  Masked in list responses, full only in the detail response.
- **No authorship column** — there is no `created_by` column: a record has a single owner and
  nothing else references a user. Recording who created or changed a record in an organization
  is a [Future epic](../README.md#future-epics) (*Authorship / audit trail*).
- **Logs** — bank request / response bodies (amounts, descriptions, account numbers) are never
  logged; only method, route and status.
- **XSS** — names, notes and descriptions are user input, always rendered escaped (React
  default).

## Owning module

- **`bank`** (lazy tier, table prefix `bank_`, already registered in
  `architecture/modular-pattern.md`) owns `Account` (`bank_accounts`) and `Transaction`
  (`bank_transactions`). **No new module.**
- **Lazy loading** — split between a small resident part and the lazy `BankModule` (see
  [modular-pattern.md](../../../architecture/modular-pattern.md#module-classification)): the thin
  controllers, the entity classes and the boot-validated `BANK_DEFAULT_CURRENCY` config are
  resident (Nest registers routes only at boot, and `autoLoadEntities` only sees entities
  registered before the `DataSource` initialises); every service, query and piece of business
  logic loads on the first bank request through `LazyModuleLoaderService#loadOnFirstRequest()`.
  `settings.json` is served from the resident config and does not load the module.
- **Depends on `auth` only through `@OwnerScoped()`** (the core guard behind a DI token); `bank`
  never imports `auth` nor queries membership tables.
- **References** — `user_id` and `organization_id` are logical (no cross-module FK);
  `bank_transactions.account_id → bank_accounts.id` is a real FK (same module).
- **No events** emitted or consumed; paying a bill is an in-module service call in one DB
  transaction (see [bills.md](../bills.md#owning-module)).
- `modules/bank.md` is created by the fold issue, not here.

### Backward compatibility

None affected: new tables and routes only, and there is no production data.

### Memory footprint

No idle cost — `bank` is lazy. No new heavy dependency: currency data comes from the built-in
`Intl`.

## Edge cases

- **Name clash** — create / rename / unarchive onto an active name → 409 (DB-enforced).
- **Archived account** — field edits other than `name` → 409 (transaction writes too, see
  [transactions.md](transactions.md#edge-cases)).
- **Currency change with transactions** → 409.
- **Delete with transactions** → 409 (DB-enforced by `ON DELETE RESTRICT`).
- **Non-`regular` `type` on create** → 400 until the other type specs exist.
- **Over-long fields** → 400, never truncated.
- **Unknown / foreign / wrong-context / non-numeric ids** → 404, indistinguishable.
- **Concurrent edits** — last write wins; no optimistic locking.

## Alternatives considered

- **Cascade delete** of an account with history — rejected in favour of
  [archive](#archive-vs-delete); hard delete is only for accounts without transactions.
- **Field-level encryption of the account number** — rejected: plain storage over a TLS
  connection, masked in lists (see [Data sensitivity](#data-sensitivity--ownership)).
- **A `Bank` catalogue entity** — rejected: `bankName` is free text.

The ledger-side alternatives are listed in
[transactions.md](transactions.md#alternatives-considered).

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Skeleton sub-issue: https://github.com/darthjee/ward/issues/27
- Owning sub-issue: https://github.com/darthjee/ward/issues/29
- Organizations, `@OwnerScoped()`, data-ownership rule: https://github.com/darthjee/ward/issues/28,
  https://github.com/darthjee/ward/issues/40,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/auth/organizations.md
- Bank ownership contract: https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/README.md#bank-ownership-contract
- Realignment to the ownership model: https://github.com/darthjee/ward/issues/41
- DB connection over TLS: https://github.com/darthjee/ward/issues/11
- Ledger, currency and transactions: https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/transactions.md
- Modular pattern (lazy tier, logical references): https://github.com/darthjee/ward/blob/main/docs/agents/architecture/modular-pattern.md
- Cache classes (`user-scoped`, `never`, `X-Skip-Cache`): https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md

## Required tests

**Backend**

- Create: `type` defaults to `regular`; `currency` defaults to `BANK_DEFAULT_CURRENCY` when
  omitted; any other `type` → 400; missing, blank or whitespace-only `name` → 400; `name` is
  trimmed; `name` of 255 characters OK, 256 → 400; `bank_name` / `branch` / `account_number`
  over 64 and `notes` over 2000 → 400 (never truncated); unknown fields → 400;
  `userId` / `organizationId` in the body → 400 (whitelist).
- Owner context: every account route works under both `/api/bank` and
  `/api/orgs/:orgId/bank`; an account created on a personal route is owned by the current user,
  one created on an organization route by that organization; owner fields (`user_id`,
  `organization_id`) never appear in any response.
- 404 with identical bodies, on every account route, for: unknown and non-numeric ids, another
  user's personal account, an organization account on a personal route, a personal account on
  an organization route, another organization's account, a non-member `:orgId`, and a global
  admin who is not a member.
- The personal list returns only the current user's personal accounts, never organization
  accounts (even of the user's own organizations).
- Name uniqueness: a case-insensitive clash with an active account → 409 on create, rename and
  unarchive; an archived account's name does not clash. Per owner: duplicates clash within
  Personal and within one organization; the same name is allowed in Personal and in an
  organization, and in two different organizations.
- DB: a row with both owners or with neither is rejected by the check constraint.
- List: returns `regular` accounts only by default, sorted by name; archived accounts hidden
  unless `archived=true` (and marked when shown); `account_number` masked (`•••• 1234`);
  current balance per account computed by a single grouped query (no N+1).
- Detail: full `account_number` and current balance.
- PATCH: `type` rejected; `currency` change → 409 once the account has transactions, allowed
  before; on an archived account only `name` is accepted (any other field → 409).
- Archive sets `archived_at`; unarchive clears it; unarchive onto an active name → 409.
- Delete succeeds with no transactions (opening anchor only); with transactions → 409 with a
  message pointing to archive; the FK `ON DELETE RESTRICT` refuses the delete even if the
  check is bypassed.
- Responses are `snake_case`.
- `GET` routes are `user-scoped` and send `X-Skip-Cache`; writes are `never`.
- Request / response bodies are not logged.

**Frontend**

- List: columns name, bank, masked account number, currency, balance formatted with `Intl` in
  the account's currency; no grand total; sorted by name; *Show archived* toggle reveals marked
  archived rows; empty state with a create button; a row opens the detail page.
- Detail: full account number and balance; Delete shown only when the account has no
  transactions; an archived account shows the banner and only Unarchive and Rename.
- Create / Edit: currency select is searchable and defaults to the value from `settings.json`;
  currency locked once the account has transactions; opening date defaults to today and opening
  balance to 0; `type` is not shown.
- Pages render under both `/bank/...` and `/orgs/:orgId/bank/...`, with links built from the
  active context; a user with zero organizations uses the Accounts pages in Personal.
- Names, notes and other user input are rendered escaped.
