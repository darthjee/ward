# Regular accounts

> **Owned by [#29](https://github.com/darthjee/ward/issues/29).** This file defines regular
> accounts and the **fields and rules common to every account type**. The debt, investment and
> provider-expense files ([#30](https://github.com/darthjee/ward/issues/30)–[#32](https://github.com/darthjee/ward/issues/32))
> add only their type-specific fields and reuse everything here. The ledger, balances, currency
> and transactions are in [transactions.md](transactions.md).

## Summary

- A regular account is an `Account` with `type` `regular` (see [README.md](README.md)).
- It belongs to an organization (see
  [auth/organizations.md](../../auth/organizations.md#data-ownership)), never directly to a user.
- Regular accounts are the only ones shown in the main **Accounts** list.
- A regular account always carries a ledger (see [transactions.md](transactions.md#ledger)).

## Common account fields

Shared by every account type (`bank_accounts` table). Each type's own file adds only its
specific fields.

| Field | Required | Editable | Notes |
|---|---|---|---|
| `id` | — | — | |
| `organizationId` | yes | no | Taken from the URL's `:orgId`, never from the request body |
| `type` | yes | no | `regular` / `debt` / `investment` / `provider_expense`; fixed after creation because type-specific fields hang off it |
| `name` | yes | yes | Trimmed, max 255 characters; **unique within the organization**, case-insensitive, among non-archived accounts (see [Name uniqueness](#name-uniqueness)) |
| `bankName` | no | yes | Free text (no `Bank` catalogue entity) |
| `branch` | no | yes | Free text (bank branch / "agência"); optional because not every user wants to record it |
| `accountNumber` | no | yes | Free text (formats vary, check digits included); optional for the same reason. **Masked in lists** (e.g. `•••• 1234`), shown in full only on the detail page |
| `currency` | yes | see [Currency](transactions.md#currency) | ISO 4217 code |
| `archivedAt` | no | via archive / unarchive | `null` = active; see [Archive vs delete](#archive-vs-delete) |
| `notes` | no | yes | Free text |
| `createdByUserId` | yes | no | The member who created the account (audit); stored, never returned (see [Data sensitivity](#data-sensitivity--ownership)) |
| `createdAt` / `updatedAt` | — | — | |

- **Opening anchor** — `openingDate` and `openingBalance` are added to `Account` by
  [transactions.md](transactions.md#opening-balance-anchor-model) for every account type that
  carries a ledger (so always for `regular`).
- **Length limits** — `name` 255; `bank_name`, `branch`, `account_number` 64; `notes` 2000.
  Over the limit → **400**, never truncated.

## Name uniqueness

- A name is unique within its organization, **case-insensitively**, among **active**
  (non-archived) accounts of any type. Archived accounts' names are free.
- **Enforced in the DB** — a generated column
  `active_name_key = IF(archived_at IS NULL, LOWER(name), NULL)` with a unique index on
  `(organization_id, active_name_key)` (NULLs never clash, so archived names never collide).
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
the active organization, `/orgs/:orgId/bank/accounts…`.

### List — `/orgs/:orgId/bank/accounts`

- `regular` accounts only. Columns: name, bank, masked account number (`•••• 1234`), currency,
  current balance (formatted with `Intl` in the account's own currency; **no grand total**,
  since currencies may differ).
- Sorted by name; no pagination.
- *Show archived* toggle (archived rows marked); **New account** button.
- Empty state: "No accounts yet" with a create button.
- A row opens the detail page.

### Detail — `/orgs/:orgId/bank/accounts/:accountId`

- Header: all fields (full account number) and the current balance.
- Actions: Edit, Archive / Unarchive, Delete (shown only when the account has no
  transactions). An archived account shows a banner and only **Unarchive** and **Rename**.
- **Ledger**: date, description, amount, running balance; **newest first**, the virtual opening
  row last; **paginated, 50 rows per page** (the running balance stays correct across pages).
  Ledger behaviour is defined in [transactions.md](transactions.md#ledger).
- **Transactions are added and edited inline**, in a form row at the top of the ledger;
  deleting asks for confirmation.

### Create / Edit — `/orgs/:orgId/bank/accounts/new`, `/orgs/:orgId/bank/accounts/:accountId/edit`

- Fields: name, bank, branch, account number, currency, opening date, opening balance, notes.
- Currency: searchable ISO select, defaulting to `BANK_DEFAULT_CURRENCY` (read from
  [`settings.json`](transactions.md#settings)); locked once the account has transactions.
- Opening date defaults to today, opening balance to 0.
- `type` is not shown — always `regular` from this submenu.

## Routes and permissions

All bank routes are JWT-protected, live under `/api/orgs/:orgId/bank`, go through
`@OrgScoped()` and use the `.json` suffix. The account routes below are **generic for every
account type**; the transaction and settings routes are in
[transactions.md](transactions.md#routes), which reuses the [Rules](#rules) below.

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

- **404, never 403** — an account of another organization, an unknown or non-numeric id: all
  404, indistinguishable.
- **The list masks `account_number` server-side** (`•••• 1234`); only the detail returns it in
  full, so the full number never travels when not needed.
- **Bodies never accept** `organizationId`, `accountId`, `createdByUserId`, `type` (on PATCH)
  or computed fields; unknown fields are rejected by the whitelist `ValidationPipe`.
- **Permissions** — every member of the organization can do everything: roles are stored but
  not enforced (as in [#28](https://github.com/darthjee/ward/issues/28)). The permission-system
  epic adds the per-role matrix (see [Future epics](../README.md#future-epics)).
- **Caching** — `GET` routes are `user-scoped` (declared with `@CachePolicy`, sent with
  `X-Skip-Cache`); writes are `never`. None goes into Navi's warm-up.
- Responses are `snake_case`, as the organization routes.

## Data sensitivity & ownership

Accounts and ledgers are **financial data**. These rules apply to the whole `bank` module,
including [transactions.md](transactions.md).

- **Who sees and edits** — only members of the owning organization (all members equally while
  roles are not enforced). Ward's global admin gets **no** access (#28). No cross-organization
  access; every miss is a 404.
- **Never stored** — bank credentials, card numbers or CVVs; Ward never connects to banks (no
  open-banking / scraping). Stated explicitly so no later issue adds it silently.
- **Account number at rest** — **not encrypted**: it is not a credential, it is optional, and
  the DB connection is already over TLS ([#11](https://github.com/darthjee/ward/issues/11)).
  Masked in list responses, full only in the detail response.
- **`createdByUserId`** — stored but **not returned by the API** (organization responses never
  expose other users' ids, #28). Showing it (as a username) is for the joining / permission
  epics. A logical reference with no cascade: the data belongs to the organization.
- **Logs** — bank request / response bodies (amounts, descriptions, account numbers) are never
  logged; only method, route and status.
- **XSS** — names, notes and descriptions are user input, always rendered escaped (React
  default).

## Owning module

- **`bank`** (lazy tier, table prefix `bank_`, already registered in
  `architecture/modular-pattern.md`) owns `Account` (`bank_accounts`) and `Transaction`
  (`bank_transactions`). **No new module.**
- **Lazy loading** — every bank controller goes through
  `LazyModuleLoaderService#loadOnFirstRequest()`; nothing of `bank` is resident before the
  first bank request (`settings.json` loads it too — it is only hit from the bank UI).
- **Depends on `auth` only through `@OrgScoped()`** (the core guard behind a DI token); `bank`
  never imports `auth` nor queries membership tables.
- **References** — `organization_id` and `created_by_user_id` are logical (no cross-module FK);
  `bank_transactions.account_id → bank_accounts.id` is a real FK (same module).
- **No events** emitted or consumed for now; bills
  ([#33](https://github.com/darthjee/ward/issues/33)) decide whether paying a bill emits an
  event or calls `bank` directly.
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
- **Unknown / foreign / non-numeric ids** → 404, indistinguishable.
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
- Organizations, `@OrgScoped()`, data-ownership rule: https://github.com/darthjee/ward/issues/28,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/auth/organizations.md
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
  `organizationId` / `createdByUserId` in the body rejected; `organizationId` is taken from the
  URL and `createdByUserId` from the current user.
- Name uniqueness: a case-insensitive clash with an active account → 409 on create, rename and
  unarchive; an archived account's name does not clash; the same name in another organization
  does not clash.
- List: returns `regular` accounts only by default, sorted by name; archived accounts hidden
  unless `archived=true` (and marked when shown); `account_number` masked (`•••• 1234`);
  current balance per account computed by a single grouped query (no N+1);
  `created_by_user_id` absent.
- Detail: full `account_number` and current balance; `created_by_user_id` absent.
- Unknown, non-numeric and other-organization `:accountId`, and a non-member `:orgId`, → 404
  with identical bodies, on every account route; a global admin who is not a member → 404.
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
- Names, notes and other user input are rendered escaped.
