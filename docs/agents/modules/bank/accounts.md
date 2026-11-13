# Bank — Accounts

The fields and rules shared by every account type, and the `regular` account itself. Each other
type ([debt](debt.md), [investment](investment.md), [provider expense](provider-expense.md))
adds only its own fields and reuses everything here. The ledger, balances and currency are in
[transactions.md](transactions.md). Part of the [Bank module](../bank.md).

Endpoints: [Routes — Bank → Accounts](../../backend/routes/bank.md#accounts).

## Common account fields

`Account` (`bank_accounts`), shared by every type:

| Field | Required | Editable | Notes |
|---|---|---|---|
| `id` | — | — | |
| `userId` / `organizationId` | one of them | no | The owner, taken from the route; exactly one is set (DB check constraint). Never read from a body, never returned. See the [ownership contract](../bank.md#bank-ownership-contract) |
| `type` | yes | no | `regular` / `debt` / `investment` / `provider_expense`; fixed after creation |
| `name` | yes | yes | Trimmed, at most 255 characters; unique per owner among active accounts (see [Name uniqueness](#name-uniqueness)) |
| `bankName` | no | yes | Free text (no `Bank` catalogue); relabelled Creditor / Institution / Provider by type |
| `branch` | no | yes | Free text (bank branch, "agência") |
| `accountNumber` | no | yes | Free text, check digits included; masked in responses (see [Data sensitivity](#data-sensitivity-and-ownership)) |
| `currency` | yes | while no transactions | ISO 4217 code (see [Currency](transactions.md#currency)) |
| `openingDate` / `openingBalance` | yes | yes | The ledger's opening anchor (see [transactions.md](transactions.md#opening-balance-anchor)) |
| `archivedAt` | no | via archive / unarchive | `null` = active |
| `notes` | no | yes | Free text |
| `createdAt` / `updatedAt` | — | — | |

- **Length limits** — `name` 255; `bank_name`, `branch`, `account_number` 64; `notes` 2000.
  Over the limit → 400, never truncated. Optional text fields are trimmed and blank becomes
  `null`.
- **Opening date** — optional in the API; it defaults to UTC today and accepts any date up to
  UTC today + 1 day. The opening balance defaults to `0`.
- **Concurrent edits** — last write wins; no optimistic locking.

## Name uniqueness

- A name is unique within its owner (Personal or one organization) among **active** accounts of
  **any type**: a regular "Nubank" and a debt "Nubank" clash. Archived accounts' names are free.
- The comparison is **case-insensitive and accent-sensitive** ("Itaú" and "Itau" are different
  names).
- **Enforced in the DB** — a generated column
  `active_name_key = IF(archived_at IS NULL, LOWER(name), NULL)` (collation
  `utf8mb4_0900_as_cs`) with two unique indexes, `(user_id, active_name_key)` and
  `(organization_id, active_name_key)`. NULLs never clash, so archived names and the other owner
  kind's rows are ignored. MySQL has no partial indexes, hence two indexes; they also serve as
  the owner lookup indexes.
- A clash answers **409 `ACCOUNT_NAME_TAKEN`** on create, rename and unarchive.

## Archive vs delete

Applies to every account type.

**Archive is the normal way to retire an account.**

- Archive sets `archivedAt`; unarchive clears it. Both answer 200 and are idempotent.
- Archived accounts are hidden from the lists unless *Show archived* is on, and are marked when
  shown.
- The detail page, ledger and bill history keep working: history is never lost.
- **Read-only while archived** — only **rename** and **unarchive** are allowed. Any other field
  → **409 `ACCOUNT_ARCHIVED`**, and so is any transaction write. (The accountant hand-off marks
  are the one exception, see [provider-expense.md](provider-expense.md#marking-as-sent).)
- Unarchive re-checks the name rule (409 on a clash); renaming is allowed while archived for
  exactly this reason.

**Hard delete is only for mistakes.**

- An account can be deleted only when it has **no transactions** (the opening anchor lives on
  the account and does not count). Otherwise **409 `ACCOUNT_HAS_TRANSACTIONS`**, with a message
  pointing to archive.
- The real FK `bank_transactions.account_id → bank_accounts.id ON DELETE RESTRICT` covers the
  race between the check and the delete (also 409).
- Deleting an account also deletes, through `ON DELETE CASCADE`:
  - its details row (debt, investment or provider);
  - for a provider-expense account, its **one-off bills** and their payment rows (a paid bill
    always has transactions, so only unpaid or skipped bills can go this way);
  - its **skip-only** `bank_bill_payments` rows (a paid row has transactions).
- Cascade delete of an account with history is not provided.

## Regular accounts

- A `regular` account is an everyday bank account. It has no details table and no nested
  object.
- Regular accounts are the only ones in the main **Accounts** list, and the only accounts that
  can **pay bills** (see [bills.md](bills.md)).
- The UI is described in [ui.md](ui.md#accounts).

## Data sensitivity and ownership

Accounts and ledgers are financial data. These rules apply to the whole `bank` module.

- **Who sees and edits** — in Personal, only the owner (from the JWT, never the URL or body),
  never organization members; in an organization, every member, with equal rights. Ward's
  global `is_admin` sees neither. Every miss is the uniform 404.
- **Never stored** — bank credentials, card numbers or CVVs. Ward never connects to banks (no
  open banking, no scraping).
- **Account number at rest** — not encrypted: it is not a credential, it is optional, and the
  DB connection is over TLS ([#11](https://github.com/darthjee/ward/issues/11)).
- **Account number in responses** — masked (`•••• ` plus the last 4 characters) in every
  response except the detail (`GET <base>/accounts/:accountId.json`), which returns it in full.
- **No authorship column** — there is no `created_by`: a record has a single owner and nothing
  else references a user. Recording who created or changed a record is the *Authorship / audit
  trail* epic ([#95](https://github.com/darthjee/ward/issues/95)).
- **Logs** — bank request and response bodies are never logged; only method, route and status.
- **XSS** — names, notes and descriptions are rendered escaped (React text).

## Alternatives considered

- **Cascade delete of an account with history** — rejected in favour of archive.
- **Field-level encryption of the account number** — rejected: plain storage over TLS, masked
  in responses.
- **A `Bank` catalogue entity** — rejected: `bankName` is free text.

## Deferred

- Authorship / audit trail: [#95](https://github.com/darthjee/ward/issues/95)
- Move an account between owners: [#93](https://github.com/darthjee/ward/issues/93)
- Organization permission system: [#81](https://github.com/darthjee/ward/issues/81)

## Differences from the original spec

- **Account number** is masked in **every** response except the detail (create, update, archive
  and unarchive included), not only in the list.
- **`opening_date`** is optional in the API: it defaults to UTC today and accepts dates up to
  UTC today + 1 day.
- **Archive and unarchive** answer 200 with the account and are idempotent.
- **`?type=`** — an unknown type on the list answers 400.
- **No `has_transactions` flag** in the account response: the frontend decides whether to show
  Delete from the loaded ledger.
- **Deleting an account** also deletes its one-off bills and skip-only payment rows
  (`ON DELETE CASCADE`), which the account spec didn't mention.
- **Name comparison** is accent-sensitive as well as case-insensitive.
