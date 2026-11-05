# Transactions

> **Owned by [#29](https://github.com/darthjee/ward/issues/29).** This file defines the
> **ledger** of an account, how its **balance** is obtained, the **`Transaction`** entity,
> **currency** handling, **categories** (deferred), and the transaction and settings routes.
> The common account fields, the account routes and the shared route rules are in
> [regular.md](regular.md).

## Ledger

- **The ledger is a generic mechanism any `Account` can carry.** Regular accounts always have
  one; debt, investment and provider-expense accounts decide in their own files
  ([#30](https://github.com/darthjee/ward/issues/30)–[#32](https://github.com/darthjee/ward/issues/32))
  whether they use it.
- Transactions belong to an `Account` (see [README.md](README.md)), and so to its
  organization.
- **Order** — newest first in the UI and API; within a day, by `id` (insertion order); no
  manual reordering. The [virtual opening row](#opening-balance-anchor-model) is always the
  oldest row.

## Balance

- **Balances are computed, never stored** — derived in SQL on read from the opening anchor and
  the transactions.
- The ledger view shows a **running balance** per row (MySQL 8 window function), computed over
  the account's whole ledger before `LIMIT`, so it stays correct across pages.
- **Current balance** = `openingBalance` + `SUM(transactions dated on or after openingDate)`.
- A stored / cached balance is only a possible future optimisation (see
  [Alternatives considered](#alternatives-considered)).

### Opening balance (anchor model)

The opening balance is a special **opening transaction** — the common approach (YNAB, Firefly
III, Quicken, GnuCash) — but it stores an **anchor**, not an amount:

- The user records a known fact: *"at the start of `openingDate` the balance was
  `openingBalance`"* (start of day = before any transaction dated that day).
- **Stored as two fields on `Account`** — `openingDate` (`DATE`) and `openingBalance` (integer
  minor units, see [Currency](#currency)) — added by this file to every account type that
  carries a ledger. They are set when the account is created and edited through the account
  `PATCH` (see [regular.md](regular.md#accounts)).
- Exactly **one** opening per account, created with the account; editable (date and balance),
  never deletable — true by construction, since it lives on the account.
- The ledger renders a **virtual opening row**, always shown as the oldest row whatever its
  anchor date. Its effective amount is derived on read:
  `openingBalance − SUM(transactions dated before openingDate)`.
- So **backfilling never changes balances from the anchor onward**; only the history before it
  adjusts, with no bookkeeping on writes.
- Keeping the anchor on `Account` keeps balance queries a plain SUM over `bank_transactions`
  and keeps `amount` with a single meaning.

**Example** — an account open for years is started in Ward with an anchor of 10,000 on 1 Nov.
Later October is backfilled (+15,000, −10,000). The opening becomes 5,000, the ledger reads
5,000 → 20,000 → 10,000, and the balance on 1 Nov is still 10,000.

**Known trade-off** — a wrongly-entered backfilled transaction is silently absorbed into the
history before the anchor instead of surfacing as a mismatch against the bank statement. The
reconciliation epic addresses it (see [Future epics](../README.md#future-epics)).

### Future-dated transactions

**Not allowed**: a transaction's date cannot be after today (see [Edge cases](#edge-cases) for
what "today" means), so each account has a single balance. "What's coming" is covered by bills
([#33](https://github.com/darthjee/ward/issues/33)). Allowing them later (with a current vs
projected balance) needs no data migration.

## Transaction entity

`Transaction` (`bank_transactions` table).

| Field | Required | Editable | Notes |
|---|---|---|---|
| `id` | — | — | |
| `accountId` | yes | no | From the URL; a transaction never moves between accounts |
| `organizationId` | yes | no | Copied from the account (data-ownership rule: every bank record carries a logical `organizationId`) |
| `date` | yes | yes | `DATE`, no time; never after today |
| `amount` | yes | yes | **Signed**: positive = money in, negative = money out; zero rejected. Storage format: see [Currency](#currency) |
| `description` | yes | yes | Trimmed, max 255 characters |
| `notes` | no | yes | Free text, max 2000 characters |
| `createdByUserId` | yes | no | Audit; stored, never returned (see [regular.md](regular.md#data-sensitivity--ownership)) |
| `createdAt` / `updatedAt` | — | — | |

- **Editable and hard-deletable** — nothing is locked until reconciliation exists.
- Transactions of an **archived account are read-only** (see
  [regular.md](regular.md#archive-vs-delete)): create / edit / delete → 409.
- Over-long fields → 400, never truncated.
- **Attachments** (receipts) are out of scope for this spec (more relevant to the accountant
  flow of #32).

## Currency

- **One currency per account**, an ISO 4217 code chosen at creation; transactions carry no
  currency of their own. A purchase in another currency is entered at the amount that actually
  left the account (as on the bank statement).
- **The currency is editable only while the account has no transactions**; afterwards a change
  would reinterpret every amount (→ 409) — create a new account instead.
- **Supported list: the full ISO 4217 list**, from `Intl.supportedValuesOf('currency')` — no
  currency table to maintain. The UI shows it as a searchable select.
- **Default: `BRL`, configurable through the `BANK_DEFAULT_CURRENCY` env var**, validated at
  boot as a supported ISO code. It pre-fills the create form and applies when a create request
  omits `currency`. The frontend reads it from [`settings.json`](#settings).
- **No conversion.** Aggregates across accounts are grouped per currency, never summed
  together.
- **Amounts are stored as integer minor units** (`BIGINT`) using the currency's own exponent
  (BRL/USD 2, JPY 0, BHD 3), taken from `Intl.NumberFormat`. Exact arithmetic, no floats.
  This applies to `amount` and to `openingBalance`.
- **In the API, amounts are decimal strings** (e.g. `"-1234.56"`); the backend rejects more
  decimals than the currency allows (e.g. `"10.555"` for BRL) with 400.
- **Overflow guard** — `|amount|` is capped at 10¹³ minor units (100 billion BRL); larger →
  400. A `BIGINT` SUM cannot overflow in practice.

## Categories

**Deferred to a future epic** (see [Future epics](../README.md#future-epics)). The ledger ships
without categories: `Transaction` has no `categoryId`. Transactions entered before the epic
stay uncategorised (adding a nullable `categoryId` later needs no backfill).

## Routes

Same base path and rules as the account routes: JWT-protected, under `/api/orgs/:orgId/bank`,
through `@OrgScoped()`, `.json` suffix, and every rule in
[regular.md → Rules](regular.md#rules) (404 never 403, whitelist `ValidationPipe`, no
client-supplied ids or computed fields, every member can do everything, `snake_case`).

### Transactions

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `/accounts/:accountId/transactions.json?page=N` | Ledger: newest first, 50 per page, running balance per row, pagination metadata; the virtual opening row is on the last page | `user-scoped` |
| POST | `/accounts/:accountId/transactions.json` | Create; 409 on an archived account | `never` |
| PATCH | `/accounts/:accountId/transactions/:transactionId.json` | Edit; 409 on an archived account | `never` |
| DELETE | `/accounts/:accountId/transactions/:transactionId.json` | Delete; 409 on an archived account | `never` |

- **A transaction of another account** (or of an account of another organization) → 404,
  indistinguishable from an unknown or non-numeric id.
- **Bodies never accept** `accountId`, `organizationId`, `createdByUserId` or computed fields
  (running balance); unknown fields → 400.
- **UI** — transactions are added and edited **inline**, in a form row at the top of the ledger
  on the account detail page (see [regular.md](regular.md#detail--orgsorgidbankaccountsaccountid));
  deleting asks for confirmation. Amounts are formatted with `Intl` in the account's currency.

### Settings

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `/settings.json` | `{ "default_currency": "BRL" }` from `BANK_DEFAULT_CURRENCY`, for the create form | `user-scoped` |

Kept organization-scoped (rather than a public route) so every bank route follows the
data-ownership rule with no exception.

## Performance & integrity

Household / small-business volumes on the Render free tier.

- **Index** `bank_transactions (account_id, date, id)` — serves the ledger order, the running
  balance, the derived opening and the balance.
- **No N+1 on the account list** — every account's current balance comes from one
  `SUM … GROUP BY account_id`.
- **Running balance** — a window function over the account's whole ledger before `LIMIT`:
  O(transactions in the account) per page, fine at this scale. If ever slow, see the stored /
  cached balance optimisation ([Balance](#balance)).
- **Delete race** — a real FK `bank_transactions.account_id → bank_accounts.id ON DELETE
  RESTRICT` (both tables belong to `bank`); the DB refuses deleting an account with
  transactions → 409 (see [regular.md](regular.md#archive-vs-delete)).
- **Concurrent edits** — last write wins; no optimistic locking.
- **No write rate limit** for now (authenticated members of their own organization).
- **Logs and data sensitivity** — bodies are never logged; see
  [regular.md](regular.md#data-sensitivity--ownership). Owning module, backward compatibility
  and memory footprint: see [regular.md](regular.md#owning-module).

## Edge cases

- **"Today" across timezones** — the server runs in UTC; a date is accepted when it is
  **≤ UTC today + 1 day**. The one-day tolerance covers every timezone (e.g. Tokyo in the
  morning) with no configuration; slightly lax, harmless.
- **Opening date** — any past date (or today); transactions may later be backfilled before it
  (the anchor model handles it).
- **Archived account** — any transaction write → 409.
- **Amount** — zero, more decimals than the currency allows, or `|amount|` over 10¹³ minor
  units → 400.
- **Over-long fields** → 400, never truncated.
- **Unknown / foreign / non-numeric ids** (account or transaction) → 404, indistinguishable.
- **Concurrent edits** — last write wins.

## Alternatives considered

- **Stored balance** — rejected in favour of a [computed balance](#balance); kept only as a
  possible future optimisation.
- **Opening as a real transaction row** — rejected in favour of
  [anchor fields on `Account`](#opening-balance-anchor-model).
- **`DECIMAL` amounts** — rejected in favour of integer minor units ([Currency](#currency)).
- **Curated currency list** — rejected in favour of the full ISO 4217 list from `Intl`.
- **Categories now** — rejected; [deferred](#categories) to a future epic.
- **Modal or separate-page transaction entry** — rejected in favour of inline entry in the
  ledger ([Routes](#routes)).
- **Public settings route** — rejected in favour of an organization-scoped
  [`settings.json`](#settings).

The account-side alternatives are listed in
[regular.md](regular.md#alternatives-considered).

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Skeleton sub-issue: https://github.com/darthjee/ward/issues/27
- Owning sub-issue: https://github.com/darthjee/ward/issues/29
- Organizations and data-ownership rule: https://github.com/darthjee/ward/issues/28,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/auth/organizations.md
- Bills (upcoming payments): https://github.com/darthjee/ward/issues/33
- Common account fields, account routes and rules: https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/regular.md
- Cache classes (`user-scoped`, `never`, `X-Skip-Cache`): https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md

## Required tests

**Backend**

- Balance arithmetic: current balance = `opening_balance` + transactions dated on or after
  `opening_date`; the virtual opening row's amount = `opening_balance` − transactions dated
  before `opening_date`; a transaction dated on `opening_date` counts after the anchor.
- Backfilling: the worked example (anchor 10,000 on 1 Nov, then +15,000 and −10,000 in
  October) gives an opening of 5,000, a ledger of 5,000 → 20,000 → 10,000, and an unchanged
  balance of 10,000 on 1 Nov.
- Ledger: newest first; order within a day by `id`; 50 rows per page; the running balance is
  correct on every page and across page boundaries; the virtual opening row is last on the
  last page; pagination metadata present.
- Transaction validation → 400: zero amount; more decimals than the currency allows (BRL 2,
  JPY 0, BHD 3); `|amount|` over 10¹³ minor units; date after UTC today + 1 day (UTC today + 1
  accepted); missing, blank or over-long `description` (255 OK, 256 → 400); `notes` over 2000;
  unknown fields; `accountId` / `organizationId` / `createdByUserId` in the body rejected.
- Amounts are stored as integer minor units and serialised as decimal strings in the
  currency's exponent (e.g. `"-1234.56"`, `"500"` for JPY).
- Archived account: create, edit and delete transaction → 409.
- A transaction of another account, of another organization, or an unknown / non-numeric id →
  404 with identical bodies; a non-member `:orgId` → 404.
- Transactions are editable and hard-deletable on an active account.
- The opening anchor is editable through the account `PATCH` and cannot be deleted.
- `currency` change → 409 once the account has a transaction.
- `BANK_DEFAULT_CURRENCY` is validated at boot (an unsupported code fails startup); unset →
  `BRL`; `settings.json` returns `{ "default_currency": … }`; non-member → 404.
- `created_by_user_id` absent from every response.
- The ledger `GET` and `settings.json` are `user-scoped` and send `X-Skip-Cache`; writes are
  `never`.

**Frontend**

- Ledger columns: date, description, amount, running balance; amounts formatted with `Intl` in
  the account's currency; newest first with the opening row last; pagination.
- Inline create / edit form row at the top of the ledger; delete asks for confirmation;
  writes are hidden on an archived account.
- Dates after today are not offered.
- Descriptions and notes are rendered escaped.
