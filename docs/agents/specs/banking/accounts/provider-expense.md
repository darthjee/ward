# Provider-expense accounts

> **Owned by [#32](https://github.com/darthjee/ward/issues/32).** Builds on
> [#29](https://github.com/darthjee/ward/issues/29): provider-expense accounts reuse the common
> account fields, name uniqueness, archive vs delete and account routes of
> [regular.md](regular.md), and the ledger, opening anchor, currency and transaction routes of
> [transactions.md](transactions.md). The type-specific fields follow the 1:1 details-table
> pattern of [debt.md](debt.md) ([#30](https://github.com/darthjee/ward/issues/30)) and
> [investment.md](investment.md) ([#31](https://github.com/darthjee/ward/issues/31)). This file
> adds only what is specific to provider-expense accounts.

## Summary

- A provider-expense account is an `Account` with `type` `provider_expense` (see
  [README.md](README.md)): **one account per provider** (e.g. an energy company, an ISP, a
  software vendor), tracking what the provider bills and what is paid to it.
- It has exactly one owner — the user (Personal) or an organization — like every account, and
  its provider details and charges inherit that owner from the account (see
  [regular.md](regular.md#data-sensitivity--ownership)).
- Provider-expense accounts are **not** shown in the main **Accounts** list; they have their own
  **Providers** submenu in the Bank menu (see [ui/menu.md](../ui/menu.md) and
  [Providers submenu UI](#providers-submenu-ui)).
- It carries the plain ledger of [transactions.md](transactions.md#ledger), the same shape as
  every other account type.
- It covers **business expenses for the accountant**: charges of flagged accounts are handed to
  the accountant as a CSV and marked as sent (see
  [Business expenses for the accountant](#business-expenses-for-the-accountant)).

## Scope

**In scope:** the provider-expense model (a payable ledger per provider), the provider-specific
fields, how charges and payments are recorded, the accountant hand-off (preview, CSV, mark as
sent / unsent), what a provider-expense account exposes for bills, the Providers submenu pages,
routes / permissions / cache class.

**Out of scope:**

- **Linked transfers** — paying a provider from a regular account as one linked operation stays
  in the *Linked transfers* [Future epic](../README.md#future-epics); until then a payment is
  two manual transactions.
- **Bill generation** — resolved by [#33](https://github.com/darthjee/ward/issues/33): see
  [Charges and bills](#charges-and-bills) and [bills.md](../bills.md).
- **Receipts / attachments** and **PDF accountant export** — deferred to the
  *Receipts / attachments* and *PDF accountant export* [Future epics](../README.md#future-epics)
  (see [Receipts / attachments](#receipts--attachments)).
- **Exporting refunds** — deferred to the *Categories* [Future epic](../README.md#future-epics)
  (see [Refunds](#refunds)).
- **Reconciliation locks on sent charges** — left to the *Reconciliation*
  [Future epic](../README.md#future-epics).
- **Currency conversion, counterparty / payee** — already deferred
  [Future epics](../README.md#future-epics).

## Ledger and balance

- A **charge** (amount billed by the provider) is a **negative** transaction.
- A **payment** to the provider is a **positive** transaction.
- The **balance** is what is still owed to the provider: `0` = settled, negative = owed,
  positive = credit with the provider (allowed, no block and no warning).
- **Opening anchor** ([transactions.md](transactions.md#opening-balance-anchor-model)) = the
  amount outstanding when recording starts — usually `0`. It is **not** forced to be negative:
  zero or positive is allowed.
- A balance at or above zero is nothing special: no badge, no archive suggestion, no automatic
  action (a provider is an ongoing relationship).

### Alternatives considered

- **An expense log** (expenses only, no payments, balance shown as per-period totals) —
  rejected: it cannot answer "do I owe this provider anything?" and diverges from every other
  account type.
- **A `Provider` entity with tagged transactions on regular accounts** — rejected: it
  contradicts #27's decision that a provider expense is an `Account` type, and overlaps the
  *Counterparty / payee* and *Categories* [Future epics](../README.md#future-epics).

## Fields

All [common account fields](regular.md#common-account-fields) apply, plus the opening anchor.
Some are reused with provider labels (no new columns):

- `bankName` is reused as the **provider** (labelled "Provider" in the UI) — no separate
  `provider` field, as debt reuses it as the creditor.
- `accountNumber` is labelled **"Customer / contract number"**; it is still masked in lists.
- `branch` stays, optional.

Provider-specific fields, stored in a 1:1 table `bank_provider_expense_details` keyed by
`account_id` (so other account types carry no provider columns):

| Field | Type | Notes |
|---|---|---|
| `forAccountant` | boolean, **required**, default `true` | Whether the account's charges are business expenses; see [Business expenses for the accountant](#business-expenses-for-the-accountant) |
| `providerTaxId` | free text, max 32, optional | The provider's tax id (e.g. CNPJ); a CSV column; shown in full (a business's public identifier) |
| `expectedAmount` | `BIGINT` minor units, > 0, optional | Typical recurring charge; within the amount bound (10¹³ minor units) of [transactions.md](transactions.md#currency); suggested by **Add charge**; available to #33 |
| `dueDay` | int 1–31, optional | Day of the month a charge is due; 29–31 clamp to the month's last day, see [bills.md](../bills.md#recurrence-model) |
| `chargeFrequency` | `monthly` \| `yearly` | Defaults to `monthly` |
| `dueMonth` | int 1–12 | Month a charge is due; required when `chargeFrequency` is `yearly`, unset otherwise |

`dueDay` / `dueMonth` mirror the names and rules of [debt.md](debt.md#fields), so #33 reads the
same shape from both types.

On `bank_transactions` (see [transactions.md](transactions.md#transaction-entity)):

- **`sentToAccountantAt`** — nullable `DATETIME`, set **only** by
  [Mark as sent](#marking-as-sent) and cleared only by Mark as unsent; the generic transaction
  body rejects it (400, whitelist). Returned only for charges of provider-expense accounts.
- A 1:1 side table for the mark was rejected: it would add a join to every export.

**Not added:** a `kind` column (the sign is enough, as in debt); a separate `provider` field;
any charge ↔ payment link (reconciliation territory).

## Recording charges and payments

- A provider-expense account's transactions are the generic `Transaction` entity and use the
  generic transaction routes of [transactions.md](transactions.md#routes) — no provider-specific
  transaction entity or routes.
- **No `kind` column** (charge / payment / refund): the sign and the description are enough.
- **UI shortcuts** on the provider detail page, purely frontend (the backend receives an
  ordinary transaction):
  - **Add charge** — opens the inline add form with a negative amount and the description
    prefilled as "Charge"; when `expectedAmount` is set, it is suggested as the amount.
  - **Add payment** — opens the inline add form with a positive amount and the description
    prefilled as "Payment".
  - The plain inline add of [regular.md](regular.md#detail) stays available.
- **Paying from a regular account** is two independent manual transactions (e.g. `-200` on the
  regular account, `+200` on the provider account), owners being the same or not. Linking them
  is the *Linked transfers* [Future epic](../README.md#future-epics) (same owner only).

## Business expenses for the accountant

### What counts

- Every provider-expense account has a **`forAccountant`** flag (default `true`): a provider is
  either a business provider or not (an office ISP vs home energy).
- Every **charge** (negative transaction) on a flagged account is a business expense;
  **payments never are**.
- Available in **both** Personal and organization contexts (e.g. a self-employed person's own
  accountant); each hand-off covers only the **active owner**.

### Hand-off

- A **preview** of the charges of every `forAccountant` account of the active owner (archived
  accounts included) for a **date range**, defaulting to the last full month — any range is
  allowed (within the [caps](#performance--security)).
- The preview defaults to **unsent charges only**, with an option to include sent ones.
- A **CSV download** of exactly the previewed rows, **built client-side** from the preview
  response — no CSV route, no backend memory, no new dependency. Columns: date, provider
  (account name and `bank_name`), provider tax id, description, amount, currency. The format is
  defined in [Performance & security](#performance--security).

### Marking as sent

- An explicit **Mark as sent** action, after downloading — never automatic on download, which
  can fail or be repeated — stamps `sentToAccountantAt` on **exactly the previewed transaction
  ids** (the request posts the ids, never a re-evaluated range).
- Re-marking is idempotent and keeps the original timestamp.
- **Mark as unsent** — a per-charge undo on the provider detail page — clears the mark; the
  charge reappears in an unsent-only preview.
- Editing or deleting a sent charge is **allowed with a warning**; an edit keeps the mark.
  Locking sent charges is left to the *Reconciliation* [Future epic](../README.md#future-epics).
- The mark inherits the owner through its transaction's account, so the
  [Bank ownership contract](../README.md#bank-ownership-contract) is unchanged.

### Receipts / attachments

**Out of scope** — no uploads, no file storage, no attachments on charges or exports
(consistent with [transactions.md](transactions.md#transaction-entity)). Deferred to the
*Receipts / attachments* [Future epic](../README.md#future-epics). A **PDF** export is
deferred to the *PDF accountant export* [Future epic](../README.md#future-epics) (heavy
library on 512 MB).

### Refunds

**Not exported.** On a provider-expense account a refund and a payment are both **positive**
transactions; with no `kind` column nothing tells them apart, so the hand-off exports
**charges only**, never a refund. Until the *Categories*
[Future epic](../README.md#future-epics) exists (telling a provider refund apart from a payment
is one of its use cases), the user reports refunds to the accountant outside Ward.

### Alternatives considered

- **A per-transaction flag** — rejected: ticking every charge, for a field meaningful only for
  this type.
- **Every provider-expense account is for the accountant** — rejected: personal providers would
  leak into the export.
- **A hand-off record (`bank_accountant_exports`)** — rejected: an owner-level record spanning
  accounts would break the "only `bank_accounts` stores the owner" rule.
- **No tracking at all** — rejected: the hand-off needs "marking as sent".
- **A server CSV route (`GET …/charges.csv`)** — rejected: it re-queries and may drift from the
  preview unless it takes ids, breaks the `.json` convention and needs download headers.
- **An `isRefund` flag or `kind` column now** — rejected: reopens the rejected `kind` decision.
- **A dedicated *Refunds* Future epic** — rejected: it needs the same transaction marker
  *Categories* already decides.

## Charges and bills

Resolved by [#33](https://github.com/darthjee/ward/issues/33) — recurring charges become
derived Calendar occurrences, and one-off bills reference a provider; see
[bills.md](../bills.md). A provider-expense account exposes, for it:

- `expectedAmount`, `chargeFrequency` (`monthly` | `yearly`), `dueDay` and `dueMonth` (yearly
  only);
- `forAccountant`;
- the computed balance, the opening date and the archived state.

No bill rows and no schedule are stored by provider-expense accounts. A balance at or above zero
is **not** a stop condition for anything. **Resolved by #33:** paying a bill records a
payment plus an optional charge ("Also record the charge"); see
[bills.md](../bills.md#paying-a-bill).

## Providers submenu UI

Provider-expense accounts get their **own "Providers" submenu** in the Bank menu (see
[ui/menu.md](../ui/menu.md)) — not shared with debts. All pages live under the active context,
`<ui>/providers…` (see [regular.md](regular.md#routes-and-permissions) for `<ui>`), and mirror
the [Accounts submenu UI](regular.md#accounts-submenu-ui) and the
[Debts submenu UI](debt.md#debts-submenu-ui).

### List

`<ui>/providers`

- `provider_expense` accounts only. Columns: name, provider, current balance, expected amount
  with its frequency (e.g. "200,00 / month"), for-accountant marker, currency. Amounts
  formatted with `Intl` in the account's own currency. **No grand total.**
- Sorted by name; no pagination.
- *Show archived* toggle (archived rows marked); **New provider** button and an
  **Accountant hand-off** link.
- Empty state: "No providers yet" with a create button.
- A row opens the detail page.

### Detail

`<ui>/providers/:accountId`

- As the [regular account detail](regular.md#detail): header, actions, archived banner,
  paginated ledger with inline add / edit.
- Plus a **provider info block**: provider tax id, expected amount, frequency, due day / month,
  for-accountant flag.
- **Add charge** / **Add payment** shortcuts above the ledger (see
  [Recording charges and payments](#recording-charges-and-payments)); hidden on an archived
  account.
- Sent charges show their `sentToAccountantAt` date and a per-charge **Mark as unsent** action
  (also available on an archived account, see [Edge cases](#edge-cases)).
- Editing or deleting a sent charge shows a warning before saving.

### Create / Edit

`<ui>/providers/new`, `<ui>/providers/:accountId/edit`

- Common fields, with "Bank" relabelled **Provider** and the account number labelled
  **Customer / contract number**; branch optional.
- Provider fields: For accountant (on by default), Provider tax id, Expected amount, Frequency,
  Due day, Due month (shown only for `yearly`).
- `type` is not shown — always `provider_expense` from this submenu.

### Accountant hand-off

`<ui>/providers/accountant`

- A **date range**, defaulting to the last full month computed from the browser's local date;
  the API receives explicit dates.
- An **"Unsent only"** toggle, on by default.
- The **preview list** of charges (date, provider, description, amount, currency, sent date);
  any totals are **per currency**, never summed.
- **Download CSV** — exactly the previewed rows (see [Performance & security](#performance--security)).
- **Mark as sent** — posts the previewed ids; disabled on an empty preview.

## Routes and permissions

Provider-expense accounts **reuse the generic account routes** of
[regular.md](regular.md#routes-and-permissions) — no `/providers.json` routes, so archive /
delete logic is not duplicated. Provider-specific data travels as a nested `provider_expense`
object. All routes live under the same base path as
[regular.md](regular.md#routes-and-permissions) (`<base>`, both contexts) and follow
[regular.md → Rules](regular.md#rules).

### Accounts

| Method | Route | Change for provider-expense accounts | Cache class |
|---|---|---|---|
| GET | `/accounts.json?type=provider_expense&archived=false` | `type=provider_expense` lists them; each row carries its `provider_expense` object | `user-scoped` |
| POST | `/accounts.json` | Now accepts `type: "provider_expense"` with an optional `provider_expense: {…}` object | `never` |
| GET | `/accounts/:accountId.json` | Includes `provider_expense` for a provider-expense account | `user-scoped` |
| PATCH | `/accounts/:accountId.json` | Accepts `provider_expense: {…}`, merged partially; `type` stays immutable; on an archived account only `name` is accepted (as #29) | `never` |
| DELETE, archive, unarchive | unchanged | Same rules as [regular.md](regular.md#accounts) | `never` |
| Transactions, settings | unchanged | Generic routes of [transactions.md](transactions.md#routes); responses include `sent_to_accountant_at` **only** for charges of provider-expense accounts | as there |

The `provider_expense` object (`snake_case`): `for_accountant`, `provider_tax_id`,
`expected_amount` (decimal string in the account's currency exponent, as every amount),
`charge_frequency`, `due_day`, `due_month`. Unset fields are returned as `null`; on PATCH,
`null` clears an optional field.

### Hand-off routes

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `/accountant/charges.json?from=&to=&include_sent=false` | Preview: charges of every `forAccountant` account of the active owner (archived included) in the range, ordered by date then id; rows: `id`, `date`, provider (account `name` + `bank_name`), `provider_tax_id`, `description`, `amount`, `currency`, `sent_to_accountant_at` | `user-scoped` |
| POST | `/accountant/mark-sent.json` | Body `{ "transaction_ids": [...] }`; stamps them; all-or-nothing, idempotent | `never` |
| POST | `/accountant/mark-unsent.json` | Same body; clears the mark (the detail page's per-charge undo sends one id) | `never` |

### Validation

Accounts:

- A `provider_expense` object on another type (create or PATCH) → 400.
- `due_month` is required when `charge_frequency` is `yearly` and rejected (400) when it is
  `monthly`.
- Ranges → 400 when outside: `due_day` 1–31, `due_month` 1–12, `expected_amount` > 0 (and
  within the amount bound and currency decimals of [transactions.md](transactions.md#currency)),
  `provider_tax_id` at most 32 characters.
- Unknown fields inside `provider_expense` are rejected by the whitelist `ValidationPipe`;
  `provider_expense: null` → 400.
- **Non-nullable fields** (decided in #54) — `charge_frequency` (default `monthly`) and
  `for_accountant` (default `true`) never accept `null` (400); every other field accepts
  `null` to clear it.
- **Paired rule on the merged state** (decided in #54) — `charge_frequency` ↔ `due_month` is
  checked on the stored details (or the defaults, on create) with the request merged on top,
  not on the request body alone (as #50 does for debts):
  - yearly with `due_month` 3: `{ due_day: 10 }` and `{ due_month: 7 }` are accepted;
    `{ due_month: null }` → 400; `{ charge_frequency: "monthly" }` is accepted and clears
    `due_month`; `{ charge_frequency: "monthly", due_month: 5 }` → 400;
  - monthly: `{ due_month: 5 }` → 400; `{ charge_frequency: "yearly" }` → 400 (no month);
    `{ charge_frequency: "yearly", due_month: 5 }` is accepted;
  - on create, `{ charge_frequency: "yearly" }` without `due_month` → 400.
- **`expected_amount` on a currency change** (decided in #54) — a `currency` change (allowed
  only before any transaction) rescales the stored `expected_amount` like `opening_balance`,
  keeping its decimal value (`200.00` BRL → `200` JPY); when it cannot be represented → 400
  (`12.50` BRL → JPY). When the same PATCH sends `expected_amount`, the stored value is not
  rescaled and the sent value is validated against the new currency (`null` clears it).
- **`provider_tax_id`** (decided in #54) — free text, treated like `bank_name` / `branch`:
  trimmed, blank → `null`, at most 32 characters, no format check (it is not always a CNPJ).
- A transaction body with `sentToAccountantAt` / `sent_to_accountant_at` → 400.

Hand-off:

- `from` / `to` are required ISO dates; `from` after `to`, a missing date, a future date or a
  range over **366 days** → 400.
- More than **1000** charges in the preview → 400 ("narrow the range"), so a hand-off is never
  silently partial. An empty range → an empty list.
- `transaction_ids`: an empty list → 400; more than **1000** ids → 400; duplicates are
  de-duplicated.
- **All-or-nothing** — nothing is stamped or cleared when any id fails: an unknown, another
  owner's or wrong-context id → **404**; a payment or a charge of a non-`forAccountant` account
  → **400**.

### Permissions and caching

Same as [regular.md](regular.md#rules):

- **404, never 403** — misses (unknown, non-numeric, another owner's or wrong-context ids,
  non-member `:orgId`) are indistinguishable.
- **Permissions** — in Personal, only the owner; in an organization context, every member can
  do everything (roles are stored but not enforced).
- **Bodies** are whitelisted; never accepted: `userId`, `organizationId`, `accountId`, `type`
  on PATCH, computed fields, and `sentToAccountantAt` (set only through the hand-off routes).
  Responses never contain owner fields.
- **Caching** — `GET` routes, the hand-off preview included, are `user-scoped` (declared with
  `@CachePolicy`, sent with `X-Skip-Cache`); writes are `never`. Nothing goes into Navi's
  warm-up — personal routes carry no owner in the URL, so they **must** stay user-scoped.

## Performance & security

**Security**

1. **CSV formula injection** (a frontend rule, since the CSV is built client-side) — **text**
   cells (provider name, `bank_name`, `provider_tax_id`, description) starting with `=`, `+`,
   `-`, `@`, tab or carriage return get a leading `'` (OWASP); the numeric **amount** column is
   not prefixed (negative amounts start with `-`). Every field is quoted, embedded quotes
   doubled.
2. **CSV format** — UTF-8 **with BOM** (accents in Excel), comma-separated, `.` decimal point,
   ISO dates; filename `ward-accountant-<from>-<to>.csv` (no owner or organization name).
3. **Ownership in the mark routes** — all ids are resolved in **one query** joined to
   `bank_accounts` and filtered by the active owner; any unresolved id → 404; the 400 cases
   (payments, non-`forAccountant` charges) are checked in the same pass; the update runs in one
   DB transaction.
4. **Unchanged** — no owner fields in responses; whitelisted bodies, never logged; XSS
   escaping; no credentials; `provider_tax_id` shown in full, `account_number` masked in lists;
   **no rate limit** (authenticated users acting in their own context, as transactions).

**Performance**

5. **Range cap** — `to − from` ≤ 366 days, else 400.
6. **Row / id caps** — the preview returns at most 1000 charges (ordered by date, then id), more
   → 400; `transaction_ids` ≤ 1000.
7. **Indexes** — the preview walks the owner's `forAccountant` accounts (owner index on
   `bank_accounts` + the details table), then their charges through the existing
   `bank_transactions (account_id, date, id)` index of
   [transactions.md](transactions.md#performance--integrity) — no new index (none for
   `sent_to_accountant_at` either); the `id` suffix gives the date-then-id order for free.
8. **Mark update** — one `UPDATE … WHERE id IN (…) AND sent_to_accountant_at IS NULL`
   (idempotent, keeps the original timestamp).

## Data sensitivity & ownership

As [regular.md](regular.md#data-sensitivity--ownership): provider fields and charges are
financial data but not credentials — masked account number in lists, no extra encryption;
request / response bodies are never logged. Provider-expense accounts, their details and their
charges (with their sent marks) inherit the owner from the account: in Personal only the owner
sees them, in an organization every member; Ward's `is_admin` sees neither.

## Owning module

- **`bank`** (lazy tier), as [regular.md](regular.md#owning-module) — **no new module**.
- **Tables** — one new table, `bank_provider_expense_details`: `account_id` is both PK and real
  FK to `bank_accounts.id` (`ON DELETE CASCADE`, same module), plus the provider fields; and one
  new nullable column, `bank_transactions.sent_to_accountant_at`. Neither carries owner
  columns — the owner comes from the account.
- **Other modules** — only `auth`, through the existing `@OwnerScoped()` guard behind its DI
  token. No new cross-module access and no events.
- **Shape (implementation hint)** — a provider-details part inside `bank`, called by the generic
  account service when `type = provider_expense`, plus an accountant hand-off controller for the
  three hand-off routes (mounted under both prefixes, like every bank controller).

### Backward compatibility

Additive: a new table, a new nullable column, a newly accepted `type` value, a nested
`provider_expense` object present only on provider-expense accounts and three new routes.
Other account types are unchanged. The only behaviour change is that `POST /accounts.json` with
`type: provider_expense` no longer answers 400 (the [regular.md](regular.md#accounts) "until
the other type specs exist" rule, reconciled by #50, #52 and #54: every type now has a
registered handler, so only an unknown type answers 400).

### Memory footprint

Negligible: one small table and one column in the already-lazy `bank` module, no new
dependency; the CSV is built in the browser and the preview is capped at 1000 rows.

## Edge cases

**Marking as sent**

1. **Data changes between download and mark** — the hand-off page shows a preview list;
   **Download CSV** and **Mark as sent** act on **exactly those transaction ids** (Mark as sent
   posts the ids), never on a re-evaluated range.
2. **Foreign or invalid ids in the mark request** — all-or-nothing, nothing stamped: an
   unknown, another owner's or wrong-context id → 404; a payment or a charge of a
   non-`forAccountant` account → 400.
3. **Already-sent charge** — re-marking is idempotent and keeps the original
   `sentToAccountantAt`.
4. **Undo** — a per-charge **Mark as unsent** on the provider detail page clears the mark.
5. **Archived provider account** — included in exports; mark sent / unsent is **allowed**
   (hand-off metadata, not a ledger edit) — an explicit exception to the archived read-only
   rule of [regular.md](regular.md#archive-vs-delete); create / edit / delete of its
   transactions stay 409.

**What is exported**

6. **`forAccountant` turned off** after charges were sent — the marks are kept and the account
   leaves future exports; turned back on, it returns and its sent charges stay sent.
7. **Positive transactions** (payments, provider refunds) are never exported; refunds are
   reported outside Ward for now (see [Refunds](#refunds)).
8. **Mixed currencies** — a currency column per CSV row; any totals on the page are per
   currency, never summed.
9. **Empty range** — the CSV has just the header row; Mark as sent is disabled; an empty id list
   posted to the API → 400.
10. **Invalid range** — `from` after `to`, a missing date or a future date → 400. "Last full
    month" is computed from the browser's local date; the API receives explicit dates.

**Account and ledger**

11. **Charge edited / deleted after being sent** — warned; an edit keeps the mark; a deletion
    removes the charge (and its mark) as usual.
12. **Charge differs from `expectedAmount`** — not validated (a suggestion only).
13. **Archive / delete** — [regular.md](regular.md#archive-vs-delete) rules unchanged; `type`
    stays fixed; sent marks do not block deletion; the details row is removed with the account
    (`ON DELETE CASCADE`).
14. **Name uniqueness** — provider accounts count in the per-owner, case-insensitive
    [rule](regular.md#name-uniqueness) like every type: a regular "Vivo" and a provider "Vivo"
    clash (409).

Also, as debt and investment: **no `provider_expense` object on POST** still creates a
`bank_provider_expense_details` row (`for_accountant` `true`, `charge_frequency` `monthly`, the
rest null), so reads never handle a missing row; **switching frequency** `yearly` → `monthly`
clears `due_month`, `monthly` → `yearly` without `due_month` → 400; **wrong-type deep links**
redirect to the account's own type's path (`<ui>/providers/:id` for a provider-expense account).

## Resolved questions

- [x] Whether provider-expense and debt accounts share one submenu — **one each**: providers get
  their own **Providers** submenu (see [Providers submenu UI](#providers-submenu-ui) and
  [ui/menu.md](../ui/menu.md)).
- [x] Whether provider-expense accounts generate bills — yes, decided by #33 in
  [bills.md](../bills.md); see [Charges and bills](#charges-and-bills).
- [x] How expenses are collected and handed to the accountant — see
  [Business expenses for the accountant](#business-expenses-for-the-accountant).
- [x] Fields specific to provider-expense accounts — see [Fields](#fields).
- [x] Routes, permissions and cache class — see [Routes and permissions](#routes-and-permissions).

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Skeleton sub-issue: https://github.com/darthjee/ward/issues/27
- Owning sub-issue: https://github.com/darthjee/ward/issues/32
- Common account fields, account routes and rules (#29): https://github.com/darthjee/ward/issues/29,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/regular.md
- Ledger, opening anchor, currency and transactions (#29): https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/transactions.md
- Debt accounts (details-table pattern, Debts submenu): https://github.com/darthjee/ward/issues/30
- Investment accounts (details-table pattern): https://github.com/darthjee/ward/issues/31
- Bills (recurring charges): https://github.com/darthjee/ward/issues/33
- Organizations, `@OwnerScoped()`, data-ownership rule: https://github.com/darthjee/ward/issues/28,
  https://github.com/darthjee/ward/issues/40,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/auth/organizations.md
- Bank ownership contract: https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/README.md#bank-ownership-contract
- Realignment to the ownership model: https://github.com/darthjee/ward/issues/41
- Cache classes (`user-scoped`, `never`, `X-Skip-Cache`): https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md
- CSV injection (OWASP): https://owasp.org/www-community/attacks/CSV_Injection
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md

## Required tests

[regular.md](regular.md#required-tests) holds the full owner-context matrix; this list covers
only what is specific to provider-expense accounts.

**Account routes**

- Provider routes follow the [regular.md owner-context matrix](regular.md#required-tests) in
  both contexts (`/api/bank` and `/api/orgs/:orgId/bank`).
- `type=provider_expense` lists only provider accounts; they never appear in the main Accounts
  list, Debts or Investments.
- Create / read / PATCH the `provider_expense` object: `for_accountant` defaults to `true`;
  unset fields → `null`; PATCH merges partially; without the object a details row is still
  created.
- 400 on: the object on another type; `due_month` missing when yearly / present when monthly;
  `due_day` / `due_month` out of range; `expected_amount` ≤ 0, over the bound or with wrong
  decimals; `provider_tax_id` over 32; unknown keys.
- Name uniqueness: clashes with an active account of any type of the same owner → 409.

**Transactions**

- `sent_to_accountant_at` present only on charges of provider-expense accounts, absent
  elsewhere.
- A transaction body with `sentToAccountantAt` / `sent_to_accountant_at` → 400.

**Hand-off preview**

- Returns only **charges** (never payments) of `forAccountant` accounts of the **active
  owner**: archived accounts included; unflagged accounts, other owners and the other context
  excluded.
- `include_sent=false` hides sent charges; `true` shows them.
- 400 on `from` after `to`, a missing date, a future date, a range over 366 days, or more than
  1000 rows; an empty range → empty list.
- Mixed currencies: each row carries its own currency.
- Works in both contexts; non-member `:orgId` → 404.
- `user-scoped`, sends `X-Skip-Cache`.

**Mark sent / unsent**

- Stamps exactly the posted ids, not others in the range.
- Idempotent: re-marking keeps the original timestamp.
- All-or-nothing: an unknown / other-owner / wrong-context id → 404, a payment or an unflagged
  charge → 400, and nothing is stamped in either case.
- An empty list → 400; more than 1000 ids → 400; duplicates are de-duplicated.
- Allowed on an archived account, while transaction create / edit / delete there stay 409.
- Unsent clears the mark; the charge reappears in an unsent-only preview.
- `forAccountant` turned off keeps the marks and drops the account from the preview.
- Editing a sent charge keeps its mark; deleting it works.
- Both routes are `never`.

**DB**

- `bank_provider_expense_details` is 1:1 with the account and removed with it
  (`ON DELETE CASCADE`).
- No owner columns exist outside `bank_accounts`.

**UI**

- Providers submenu: List, Detail (Add charge / Add payment shortcuts) and Create / Edit.
  Add charge pre-signs negative and suggests `expectedAmount`; Add payment pre-signs positive;
  both hidden on an archived account.
- Hand-off page:
  - the range defaults to the last full month; "unsent only" is on by default;
  - the preview list renders, with per-currency totals;
  - Download CSV produces exactly the previewed rows;
  - Mark as sent is disabled on an empty preview.
- CSV generation: formula-injection escaping on text cells, negative amounts untouched, quote /
  comma escaping, BOM, filename format.
- Editing or deleting a sent charge shows a warning; Mark as unsent is on the detail page.
- Pages render under both `/bank/providers…` and `/orgs/:orgId/bank/providers…`.
- [ui/menu.md](../ui/menu.md): the **Providers** entry is shown; switching context lands on the
  Providers list.
- Names, provider, notes and descriptions are rendered escaped.
