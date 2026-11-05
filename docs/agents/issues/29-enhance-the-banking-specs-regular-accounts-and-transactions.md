# Issue: Enhance the banking specs: regular accounts and transactions

## Description

Part of Epic #26 (Bank module). Ward's first domain module, `bank` (lazy tier), tracks bank accounts, business expenses for the accountant and bills to pay, scoped to **organizations**. The feature follows the spec lifecycle in `docs/agents/specs.md`: specs are written under `docs/agents/specs/banking/` first, refined by enhancement sub-issues, then implemented, folded into the permanent docs and removed.

This sub-issue **refines the specs**: it turns the stub written by the initial-specs sub-issue
into an agreed definition. It is documentation-only — no code.

### Depends on

The initial-specs sub-issue (`docs/agents/specs/banking/` must exist). Can run in parallel with
the other spec-enhancement sub-issues.

## Problem

The skeletons `accounts/regular.md` and `accounts/transactions.md` (written by #27) record only what was already decided and leave open questions: the common account fields, how balances are obtained, the transaction entity, currency, categories, and the routes, permissions and cache class. The other account-type sub-issues (#30–#32) and the implementation sub-issues need these definitions settled first.

## Expected Behavior

Define **regular accounts and transactions** in the banking specs:

- the account entity and its common fields shared by every account type (name, bank, number,
  currency, archived state, type, owning organization, …);
- whether accounts keep a transaction ledger and show balances; the transaction entity
  (date, amount, description, category?);
- currency handling and categories;
- the **Accounts** submenu: list (regular accounts only), detail, create/edit pages;
- routes, permissions per organization role, caching class of each route.

Update the `docs/agents/specs/banking/README.md` index entry for the file(s) touched. Each
file keeps the **Reference** and **Required tests** sections required by
`docs/agents/specs.md`.

The outcome must match the agreed decisions below; the `## Scope` section lists the exact files touched.

## Solution

Agreed decisions (from the enhancement dialogue), to be written into the specs.

### Common account fields

Defined in `accounts/regular.md` and shared by every account type. Each type's own file adds only
its specific fields.

| Field | Required | Editable | Notes |
|---|---|---|---|
| `id` | — | — | |
| `organizationId` | yes | no | Taken from the URL's `:orgId`, never from the request body |
| `type` | yes | no | `regular` / `debt` / `investment` / `provider_expense`; fixed after creation because type-specific fields hang off it |
| `name` | yes | yes | Trimmed, max 255 characters; **unique within the organization**, case-insensitive, among non-archived accounts |
| `bankName` | no | yes | Free text (no `Bank` catalogue entity) |
| `branch` | no | yes | Free text (bank branch / "agência"); optional because not every user wants to record it |
| `accountNumber` | no | yes | Free text (formats vary, check digits included); optional for the same reason. **Masked in lists** (e.g. `•••• 1234`), shown in full only on the detail page |
| `currency` | yes | see *Currency* | ISO 4217 code |
| `archivedAt` | no | via archive / unarchive | `null` = active; see *Archive vs delete* |
| `notes` | no | yes | Free text |
| `createdByUserId` | yes | no | The member who created the account (audit) |
| `createdAt` / `updatedAt` | — | — | |

### Ledger and balance

Defined in `accounts/transactions.md`.

- **The ledger is a generic mechanism any `Account` can carry.** Regular accounts always have
  one; debt, investment and provider-expense accounts decide in their own files (#30–#32)
  whether they use it.
- **Balances are computed, never stored:** derived in SQL on read from the opening anchor and the
  transactions. The ledger view shows a **running balance** per row (MySQL 8 window function).
  A stored/cached balance is only a possible future optimisation.

#### Opening balance (anchor model)

The opening balance is a special **opening transaction** — the common approach (YNAB, Firefly
III, Quicken, GnuCash) — but it stores an **anchor**, not an amount:

- The user records a known fact: *"at the start of `openingDate` the balance was
  `openingBalance`"* (start of day = before any transaction dated that day).
- Exactly **one** opening per account, created with the account; editable (date and balance),
  never deletable.
- The opening row is **always shown first** in the ledger, whatever its anchor date. Its
  effective amount is derived on read:
  `openingBalance − SUM(transactions dated before openingDate)`.
- So **backfilling never changes balances from the anchor onward**; only the history before it
  adjusts, with no bookkeeping on writes.

Example: an account open for years is started in Ward with an anchor of 10,000 on 1 Nov. Later
October is backfilled (+15,000, −10,000). The opening becomes 5,000, the ledger reads
5,000 → 20,000 → 10,000, and the balance on 1 Nov is still 10,000.

Known trade-off: a wrongly-entered backfilled transaction is silently absorbed into the history
before the anchor instead of surfacing as a mismatch against the bank statement.

#### Future-dated transactions

**Not allowed**: a transaction's date cannot be after today (see *Edge cases* for what "today" means), so each account has a single
balance. "What's coming" is covered by bills (#33). Allowing them later (with a current vs
projected balance) needs no data migration.

### Transaction entity

Defined in `accounts/transactions.md` (`bank_transactions` table).

| Field | Required | Editable | Notes |
|---|---|---|---|
| `id` | — | — | |
| `accountId` | yes | no | From the URL; a transaction never moves between accounts |
| `organizationId` | yes | no | Copied from the account (data-ownership rule: every bank record carries a logical `organizationId`) |
| `date` | yes | yes | `DATE`, no time; never after today |
| `amount` | yes | yes | **Signed**: positive = money in, negative = money out; zero rejected. Storage format: see *Currency* |
| `description` | yes | yes | Trimmed, max 255 characters |
| `notes` | no | yes | Free text |
| `createdByUserId` | yes | no | Audit |
| `createdAt` / `updatedAt` | — | — | |

- **Editable and hard-deletable** — nothing is locked until reconciliation exists. Transactions
  of an archived account are read-only (see *Archive vs delete*).
- **Order within a day** is by `id` (insertion order); no manual reordering.

#### Where the opening lives

The opening anchor is stored as **two fields on `Account`** — `openingDate` and
`openingBalance` — added by `transactions.md` for every account type that carries a ledger. The
ledger renders a **virtual opening row** first. This keeps balance queries a plain SUM over
`bank_transactions`, makes "exactly one opening, never deleted" true by construction, and keeps
`amount` with a single meaning.

#### Out of scope

- **Attachments** (receipts) — out of scope for this spec (more relevant to the accountant flow
  of #32).

### Currency

- **One currency per account**, an ISO 4217 code chosen at creation; transactions carry no
  currency of their own. A purchase in another currency is entered at the amount that actually
  left the account (as on the bank statement).
- **The currency is editable only while the account has no transactions**; afterwards a change
  would reinterpret every amount — create a new account instead.
- **Supported list: the full ISO 4217 list**, from `Intl.supportedValuesOf('currency')` — no
  currency table to maintain. The UI shows it as a searchable select.
- **Default: `BRL`, configurable through an env var** (e.g. `BANK_DEFAULT_CURRENCY`), validated
  at boot as a supported ISO code. It pre-fills the create form and applies when a create
  request omits `currency`. The frontend reads it from `GET /api/orgs/:orgId/bank/settings.json` (see *Routes*).
- **No conversion.** Aggregates across accounts are grouped per currency, never summed
  together.
- **Amounts are stored as integer minor units** (`BIGINT`) using the currency's own exponent
  (BRL/USD 2, JPY 0, BHD 3), taken from `Intl.NumberFormat`. Exact arithmetic, no floats.
- **In the API, amounts are decimal strings** (e.g. `"-1234.56"`); the backend rejects more
  decimals than the currency allows (e.g. `"10.555"` for BRL).

### Categories

**Deferred to a future epic.** The ledger ships without categories: `Transaction` has no
`categoryId`. Transactions entered before the epic stay uncategorised (adding a nullable
`categoryId` later needs no backfill).

### Archive vs delete

Defined in `accounts/regular.md`, for every account type.

**Archive is the normal way to retire an account.**

- `archive` sets `archivedAt`; `unarchive` clears it.
- **Hidden by default**: the Accounts list shows active accounts only, with a *Show archived*
  toggle; archived rows are marked as such.
- **Still reachable**: the detail page and ledger keep working — history is never lost.
- **Read-only while archived**: no field edits and no transaction create / edit / delete. The
  only actions allowed are **unarchive** and **rename**.
- **Unarchive checks the name rule**: names are unique among active accounts, so unarchiving
  answers **409** when an active account already has that name; the user renames one of them
  first (renaming is allowed while archived for exactly this reason).

**Hard delete is only for mistakes.**

- An account can be hard-deleted **only when it has no transactions** (the opening anchor lives
  on the account and does not count).
- Otherwise delete answers **409**, with a message pointing to archive.
- Deleting an account with history (cascade) is **not provided**.

### Accounts submenu UI

Defined in `accounts/regular.md`; the **Accounts** row of `ui/menu.md` links to it. All pages
live under the active organization, `/orgs/:orgId/bank/accounts…`.

**List** — `/orgs/:orgId/bank/accounts`

- `regular` accounts only. Columns: name, bank, masked account number (`•••• 1234`), currency,
  current balance (formatted with `Intl` in the account's own currency; no grand total, since
  currencies may differ).
- Sorted by name; no pagination.
- *Show archived* toggle (archived rows marked); **New account** button.
- Empty state: "No accounts yet" with a create button.
- A row opens the detail page.

**Detail** — `/orgs/:orgId/bank/accounts/:accountId`

- Header: all fields (full account number) and the current balance.
- Actions: Edit, Archive / Unarchive, Delete (shown only when the account has no transactions).
  An archived account shows a banner and only Unarchive and Rename.
- **Ledger**: date, description, amount, running balance; **newest first**, the virtual opening
  row last; **paginated, 50 rows per page** (the running balance stays correct across pages).
- **Transactions are added and edited inline**, in a form row at the top of the ledger;
  deleting asks for confirmation.

**Create / Edit** — `/orgs/:orgId/bank/accounts/new`, `/orgs/:orgId/bank/accounts/:accountId/edit`

- Fields: name, bank, branch, account number, currency, opening date, opening balance, notes.
- Currency: searchable ISO select, defaulting to `BANK_DEFAULT_CURRENCY`; locked once the
  account has transactions.
- Opening date defaults to today, opening balance to 0.
- `type` is not shown — always `regular` from this submenu.

### Routes and permissions

All routes are JWT-protected, live under `/api/orgs/:orgId/bank`, go through `@OrgScoped()`
and use the `.json` suffix. Account routes are in `accounts/regular.md` (generic for every
type), transaction routes in `accounts/transactions.md`.

#### Accounts

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `/accounts.json?type=regular&archived=false` | List accounts; `type` defaults to `regular` (other types reuse the route once their spec defines them); `archived=true` includes archived ones | `user-scoped` |
| POST | `/accounts.json` | Create; only `type: regular` (default) is accepted until the other type specs exist, anything else → 400 | `never` |
| GET | `/accounts/:accountId.json` | Detail, with the full account number and the current balance | `user-scoped` |
| PATCH | `/accounts/:accountId.json` | Edit; `type` never accepted; `currency` only while the account has no transactions (else 409); on an archived account only `name` is accepted | `never` |
| DELETE | `/accounts/:accountId.json` | Hard delete; 409 when the account has transactions | `never` |
| POST | `/accounts/:accountId/archive.json` | Archive | `never` |
| POST | `/accounts/:accountId/unarchive.json` | Unarchive; 409 on a name clash | `never` |

#### Transactions

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `/accounts/:accountId/transactions.json?page=N` | Ledger: newest first, 50 per page, running balance per row, pagination metadata; the virtual opening row is on the last page | `user-scoped` |
| POST | `/accounts/:accountId/transactions.json` | Create; 409 on an archived account | `never` |
| PATCH | `/accounts/:accountId/transactions/:transactionId.json` | Edit; 409 on an archived account | `never` |
| DELETE | `/accounts/:accountId/transactions/:transactionId.json` | Delete; 409 on an archived account | `never` |

#### Settings

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `/settings.json` | `{ "default_currency": "BRL" }` from `BANK_DEFAULT_CURRENCY`, for the create form | `user-scoped` |

Kept organization-scoped (rather than a public route) so every bank route follows the
data-ownership rule with no exception.

#### Rules

- **404, never 403** — an account of another organization, a transaction of another account,
  an unknown or non-numeric id: all 404, indistinguishable.
- **The list masks `account_number` server-side** (`•••• 1234`); only the detail returns it in
  full, so the full number never travels when not needed.
- **Bodies never accept** `organizationId`, `accountId`, `createdByUserId`, `type` (on PATCH)
  or computed fields; unknown fields are rejected by the whitelist `ValidationPipe`.
- **Permissions**: every member of the organization can do everything — roles are stored but
  not enforced (as in #28). The permission-system epic adds the per-role matrix.
- Responses are `snake_case`, as the organization routes.

### Scope

**In scope** (documentation only):

- `accounts/regular.md` — common account fields, name rule, masking, currency, archive vs
  delete, account routes, the Accounts submenu pages, Required tests.
- `accounts/transactions.md` — generic ledger, opening anchor (`openingDate` /
  `openingBalance` on `Account`), `Transaction` entity, computed and running balances, no
  future-dated transactions, transaction routes, settings route, Required tests.
- `ui/menu.md` — the **Accounts** row only (status → *Specified*).
- `README.md` — index entries for the two files, and the new [Future epics](#future-epics-to-add-to-readmemdfuture-epics) entries.

**Out of scope**:

- Any code.
- What the other account types add — debt (#30), investment (#31), provider-expense (#32)
  decide their own fields and whether they use the ledger; they only *reuse* the common fields
  and generic routes defined here.
- Bills and the calendar (#33).
- Attachments / receipts.
- Enforcing per-role permissions (permission-system epic, from #28).
- Everything listed under Future epics.

### Data sensitivity & ownership

Accounts and ledgers are **financial data**.

- **Who sees and edits** — only members of the owning organization (all members equally while
  roles are not enforced). Ward's global admin gets **no** access (#28). No cross-organization
  access; every miss is a 404.
- **Never stored** — bank credentials, card numbers or CVVs; Ward never connects to banks (no
  open-banking / scraping). Stated explicitly so no later issue adds it silently.
- **Account number at rest** — **not encrypted** (not a credential, optional, DB connection
  already over TLS, #11); masked in list responses, full only in the detail response.
- **`createdByUserId`** — stored but **not returned by the API** (organization responses never
  expose other users' ids, #28). Showing it (as a username) is for the joining / permission
  epics. A logical reference with no cascade: the data belongs to the organization.
- **Logs** — bank request / response bodies (amounts, descriptions, account numbers) are never
  logged; only method, route and status.

### Performance & security

Already covered above: `@OrgScoped()` and 404 everywhere, whitelist `ValidationPipe`, no
client-supplied ids, server-side masking, no logged bodies, escaped rendering (React default).

**Performance** (household / small-business volumes, Render free tier):

- **Index** `bank_transactions (account_id, date, id)` — serves the ledger order, running balance,
  derived opening and balance.
- **No N+1 on the list** — every account's current balance comes from one
  `SUM … GROUP BY account_id`.
- **Running balance** is a window function over the account's whole ledger before `LIMIT`:
  O(transactions in the account) per page, fine at this scale. If ever slow, see the stored /
  cached balance optimisation (*Ledger and balance*).
- **Overflow guard** — `|amount|` is capped at 10¹³ minor units (100 billion BRL); larger → 400.
  A `BIGINT` SUM cannot overflow in practice.

**Integrity**:

- **Name uniqueness enforced in the DB** — a generated column
  `active_name_key = IF(archived_at IS NULL, LOWER(name), NULL)` with a unique index on
  `(organization_id, active_name_key)` (NULLs never clash, so archived names are free).
  Duplicate-key errors map to 409.
- **Delete race** — a real FK `bank_transactions.account_id → bank_accounts.id ON DELETE RESTRICT`
  (both tables belong to `bank`); the DB refuses deleting an account with transactions → 409.
- **Length limits** — `name`, `description` 255; `bank_name`, `branch`, `account_number` 64;
  `notes` 2000. Over the limit → 400, never truncated.
- **Concurrent edits** — last write wins; no optimistic locking.
- **No write rate limit** for now (authenticated members of their own organization).

### Owning module

- **`bank`** (lazy tier, table prefix `bank_`, already registered in
  `architecture/modular-pattern.md`) owns `Account` (`bank_accounts`) and `Transaction`
  (`bank_transactions`). No new module.
- **Lazy loading** — every bank controller goes through
  `LazyModuleLoaderService#loadOnFirstRequest()`; nothing of `bank` is resident before the
  first bank request (`settings.json` loads it too — only hit from the bank UI).
- **Depends on `auth` only through `@OrgScoped()`** (the core guard behind a DI token); `bank`
  never imports `auth` nor queries membership tables.
- **References** — `organization_id` and `created_by_user_id` are logical (no cross-module FK);
  `bank_transactions.account_id → bank_accounts.id` is a real FK (same module).
- **No events** emitted or consumed for now; bills (#33) decide whether paying a bill emits an
  event or calls `bank` directly.
- `modules/bank.md` is created by the fold issue, not here.

### Edge cases

- **"Today" across timezones** — the server runs in UTC; a date is accepted when it is
  **≤ UTC today + 1 day**. The one-day tolerance covers every timezone (e.g. Tokyo in the
  morning) with no configuration; slightly lax, harmless.
- **Opening date** — any past date (or today); transactions may later be backfilled before it
  (the anchor model handles it).
- **Name clash** — create / rename / unarchive onto an active name → 409 (DB-enforced).
- **Archived account** — field edits other than `name` and any transaction write → 409.
- **Currency change with transactions** → 409.
- **Delete with transactions** → 409 (DB-enforced by `ON DELETE RESTRICT`).
- **Amount** — zero, more decimals than the currency allows, or `|amount|` over 10¹³ minor
  units → 400.
- **Over-long fields** → 400, never truncated.
- **Unknown / foreign / non-numeric ids** → 404, indistinguishable.
- **Concurrent edits** — last write wins.

### Backward compatibility

None affected: new tables and routes only, and there is no production data.

### Memory footprint

No idle cost — `bank` is lazy. No new heavy dependency: currency data comes from the built-in
`Intl`.

### Alternatives considered

Rejected options are kept next to each decision: stored balance (vs computed), opening as a
real transaction row (vs anchor fields on `Account`), `DECIMAL` amounts (vs integer minor
units), curated currency list (vs full ISO list), categories now (vs deferred), cascade delete
(vs archive), modal / separate-page transaction entry (vs inline), public settings route (vs
organization-scoped), field-level encryption of the account number (vs plain).

### Testing strategy

Documentation only. The plan writes each file's **Required tests** section from the rules in
this issue (validation 400s, 409s, 404s, masking, balance / opening-anchor arithmetic including
backfilling, pagination with running balance, cache classes, UI pages).

### Future epics (to add to `README.md#future-epics`)

- **Reconciliation** — a per-transaction *cleared* flag to match the ledger against the bank
  statement, surfacing mismatches (e.g. a wrongly backfilled transaction absorbed by the
  opening anchor).
- **Linked transfers** — a transfer between two accounts of the organization recorded as one
  linked pair of transactions (until then: two independent manual transactions).
- **Counterparty / payee** — a field recording who paid or was paid.
- **Currency conversion** — FX rates and an organization base currency, so totals across
  accounts in different currencies can be shown together.
- **Categories** — categorising transactions (scope, entity, management UI, hierarchy,
  income/expense kind to be decided by the epic); likely shared with bills (#33) and
  provider expenses (#32).
- **Ledger filters** — date range and text search on an account's ledger.

## Benefits

- Every account type reuses one agreed set of common fields, routes and archive rules.
- The ledger and balance model (opening anchor, computed balances) is fixed before any code, so backfilling history never changes known balances.
- Deferred concerns are captured as future epics instead of being decided ad hoc during implementation.
