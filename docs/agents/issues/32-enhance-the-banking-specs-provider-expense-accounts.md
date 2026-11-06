# Issue: Enhance the banking specs: provider-expense accounts

## Description

Part of Epic #26 (Bank module). Defines **provider-expense accounts** in the banking specs —
accounts that track what is billed by and paid to one provider — including the hand-off of
**business expenses to the accountant**. Like every bank record, a provider-expense account has
exactly one owner, the user (Personal) or an organization (Bank ownership contract, #40), and is
written against the specs realigned by #41. Documentation only — no code.

## Problem

`accounts/provider-expense.md` is still the #27 stub: the model, fields, accountant hand-off,
menu placement, relation to bills, routes, permissions and caching are all open questions, and
`ui/menu.md` still asks whether providers share the Debts submenu.

## Expected Behavior

- `accounts/provider-expense.md` is a full spec: every stub open question is closed, and it
  keeps its **Reference** and **Required tests** sections.
- `transactions.md`, `ui/menu.md` and the banking `README.md` get the small edits listed in
  [Scope](#scope).
- Implementation can start from the spec with no further product decision.

## Solution

### Provider-expense model

**A payable account per provider.**

- One `provider_expense` account per provider (e.g. an energy company, an ISP, a software
  vendor). `bankName` is reused as the **provider** (labelled "Provider" in the UI), as debt
  reuses it as the creditor — no separate `provider` field.
- It carries the plain ledger of `transactions.md`:
  - a **charge** (amount billed) is a **negative** transaction;
  - a **payment** is a **positive** transaction;
  - the **balance** is what is still owed to the provider — `0` = settled, positive = credit
    with the provider (allowed, no warning).
- **Opening anchor** = the amount outstanding when recording starts (usually `0`); not forced
  to be negative.
- The detail page has **Add charge** / **Add payment** shortcuts (pre-signed transactions, like
  debt's Add payment / Add interest).
- Paying from a regular account stays **two manual transactions** until the *Linked transfers*
  Future epic (same owner only).
- Recurring charges give the account something to **expose for bills** (#33 decides
  generation), following the debt pattern.

Rejected:

- **Expense log** (expenses only, no payments, balance shown as per-period totals) — cannot
  answer "do I owe this provider anything?" and diverges from every other account type.
- **`Provider` entity + tagged transactions on regular accounts** — contradicts #27's decision
  that provider expense is an `Account` type, and overlaps the *Counterparty / payee* and
  *Categories* Future epics.

### Business expenses for the accountant

**What counts — a per-account flag.**

- Provider-expense accounts get `forAccountant` (boolean, default `true`). A provider is either
  a business provider or not (office ISP vs home energy).
- Every **charge** (negative transaction) on a flagged account is a business expense; payments
  never are.
- Rejected: a per-transaction flag (ticking every charge, a field meaningful only for this
  type); "every provider-expense account is for the accountant" (personal providers would leak
  into the export).

**Hand-off — CSV for a date range.**

- A CSV download covering every `forAccountant` account of the **active owner**, for a date
  range (defaults to the last full month; any range allowed).
- Columns: date, provider (account), description, amount, currency.
- No new dependency, negligible memory. PDF export is deferred to a Future epic (heavy
  library).

**Marking as sent — a mark on each charge.**

- Nullable `sentToAccountantAt` on the transaction, meaningful only for charges of
  `forAccountant` accounts.
- An explicit **"Mark as sent"** action (after downloading — never automatic on download, which
  can fail or be repeated) stamps the charges in the exported range.
- The export defaults to **unsent charges only**, with an option to include sent ones.
- Editing or deleting a sent charge is allowed with a warning; locking is left to the
  *Reconciliation* Future epic.
- The mark inherits the owner through its account, so the Bank ownership contract is
  unchanged.
- Rejected: a hand-off record (`bank_accountant_exports`) — an owner-level record spanning
  accounts would break the "only `bank_accounts` stores the owner" rule; no tracking at all —
  the issue asks for "marking as sent".

**Context:** available in both Personal and organization contexts (e.g. a self-employed
person's own accountant); each export covers only the active owner.

### Receipts / attachments

**Out of scope** — no uploads, no file storage, no attachments on charges or exports (consistent
with `transactions.md`, which already leaves attachments out).

- Add a Future epic **"Receipts / attachments"** to the banking `README.md`: attach receipt
  files to transactions (charges), include them in the accountant hand-off, and decide storage
  (Render has no persistent disk on the free tier), size limits, allowed types, and access
  (attachments inherit the owner through their transaction's account, like every child record).

### Refunds

**Not exported — deferred to the *Categories* Future epic.**

- On a provider-expense account a refund and a payment are both **positive** transactions;
  with no `kind` column (the sign is enough, as in debt) nothing tells them apart, so the
  accountant hand-off exports **charges only** and never a refund.
- Until categories exist, the user reports refunds to the accountant outside Ward.
- The banking `README.md`'s existing **Categories** Future epic gets one extra sentence: telling
  a provider refund apart from a payment, so it can be exported to the accountant as a negative
  business expense, is one of its use cases.
- Rejected: a dedicated *Refunds* Future epic (it would need the same transaction marker
  Categories already decides); an `isRefund` flag or `kind` column now (reopens the rejected
  `kind` decision and grows #32); a bare "possible extension" note with no home.

### Menu placement

**Their own submenu — Providers.**

- A new **Providers** entry in the Bank menu, beside Accounts, Debts, Investments and Calendar.
  `ui/menu.md`: the provider-expense row becomes "Specified" (list, detail with the ledger and
  the Add charge / Add payment shortcuts, create / edit, accountant hand-off), and the open
  question "one shared submenu for debt and provider-expense accounts" is resolved as **one
  each** (#30's Debts row is untouched).
- Pages, same pattern as Debts / Investments (plain headings for stable anchors, path on the
  first line below):
  - `### List` — `<ui>/providers`;
  - `### Detail` — `<ui>/providers/:accountId` (ledger + Add charge / Add payment);
  - `### Create / Edit`;
  - `### Accountant hand-off` — `<ui>/providers/accountant`: date range (defaults to the last
    full month), "unsent only" toggle (on by default), **Download CSV**, **Mark as sent**.
- Same menu rules as every submenu: identical in Personal and organization contexts; switching
  context lands on the Providers list.
- Rejected: merging with Debts into one "Payables" submenu (reopens #30's specified row and
  paths, mixes two types with different shortcuts, and the accountant page concerns providers
  only); provider accounts under Accounts with a filter (breaks the regular-only main-list
  rule); the label "Expenses" (confusable with plain expense transactions).

### Fields

All common account fields of `regular.md` apply, plus the opening anchor. Reused with provider
labels (no new columns):

- `bankName` → **"Provider"**;
- `accountNumber` → **"Customer / contract number"** (still masked in lists);
- `branch` stays, optional.

Provider-specific fields in a 1:1 table **`bank_provider_expense_details`** keyed by
`account_id` (debt / investment pattern):

| Field | Type | Notes |
|---|---|---|
| `forAccountant` | boolean, **required**, default `true` | See [Business expenses for the accountant](#business-expenses-for-the-accountant) |
| `providerTaxId` | free text, max 32, optional | Provider's tax id (e.g. CNPJ); a CSV column; shown in full (a business's public identifier) |
| `expectedAmount` | `BIGINT` minor units, > 0, optional | Typical recurring charge; within the 10¹³ bound; suggested by **Add charge**; available to #33 |
| `dueDay` | int 1–31, optional | 29–31 clamp to the month's last day (applied by #33) |
| `chargeFrequency` | `monthly` \| `yearly`, default `monthly` | |
| `dueMonth` | int 1–12 | Required when `chargeFrequency` is `yearly`, unset otherwise |

`dueDay` / `dueMonth` mirror debt's names and rules, so #33 reads the same shape from both
types.

On `bank_transactions`: **`sentToAccountantAt`** — nullable `DATETIME`, set **only** by
**Mark as sent** (the generic transaction body rejects it → 400, whitelist); returned only for
charges of provider-expense accounts. A 1:1 side table was rejected (an extra join on every
export).

Not added: a `kind` column (the sign is enough, as in debt); a separate `provider` field; any
charge ↔ payment link (reconciliation territory).

### Charges and bills

**Mirror debt: expose only — #33 decides.**

- Whether and how recurring charges become bills on the Calendar is **left entirely to #33**
  (`bills.md`). A provider-expense account only exposes, for it:
  - `expectedAmount`, `chargeFrequency`, `dueDay`, `dueMonth` (yearly only);
  - `forAccountant`;
  - the computed balance, the opening date and the archived state.
- No bill rows and no schedule are stored by provider-expense accounts.
- A balance at or above zero is **not** a stop condition — a provider is an ongoing
  relationship (consistent with debt's "nothing special at zero").
- Flagged for #33: whether paying a bill records a charge, a payment, or both on the provider
  ledger.
- `provider-expense.md`'s open question "whether provider-expense accounts generate bills"
  becomes "left to #33 — see *Charges and bills*". `bills.md` is **not** edited by #32.
- Rejected: deciding generation here (pre-empts #33's recurrence model, edits #33's file, which
  would collide since #32 and #33 may run in parallel).

### Scope

**In (documentation only):**

- `accounts/provider-expense.md` — full spec replacing the stub: model, fields, accountant
  hand-off, charges and bills, Providers pages, routes / permissions / caching, data
  sensitivity, edge cases, **Reference** and **Required tests**; every stub open question
  closed.
- `accounts/transactions.md` (#29's file, minimal): a `sentToAccountantAt` row in the
  Transaction entity table linking to `provider-expense.md`; `sentToAccountantAt` added to the
  fields the transaction body never accepts; the Attachments bullet repointed to the new
  *Receipts / attachments* Future epic.
- `ui/menu.md`: the Providers row (#32's own) → "Specified"; the open question "one shared
  submenu or one each" resolved as **one each**; the Required-tests line "a place for debt /
  provider-expense accounts" → a named **Providers** entry.
- Banking `README.md`: the index entry for `provider-expense.md`; the Decisions bullet "a place
  for provider-expense accounts (decided by #32)" → **Providers**; the #32 sub-issue map row;
  Future epics **Receipts / attachments** and **PDF accountant export**; the existing
  *Categories* Future epic gains a mention of provider refunds (see [Refunds](#refunds)).
- `accounts/README.md`: no change expected (provider-expense accounts are already "seen in their
  own place").

**Out:**

- `bills.md` and `ui/calendar.md` (#33), including bill generation and paying a bill.
- Receipts / attachments and PDF export (Future epics).
- Linked transfers, categories, counterparty, reconciliation locks on sent charges (existing
  Future epics).
- The Bank ownership contract, `auth/organizations.md`, and the type-specific decisions of
  #29–#31 beyond the small `transactions.md` additions.
- `product.md` / `.claude/agents/data-access.md` (done at fold time).
- Any code.

### Edge cases

**Marking as sent**

1. **Data changes between download and mark** — the hand-off page shows a **preview list** of
   the charges in the range; **Download CSV** and **Mark as sent** act on **exactly those
   transaction ids** (Mark as sent posts the ids), never on a re-evaluated range.
2. **Foreign or invalid ids in the mark request** — all-or-nothing, nothing stamped: unknown,
   another owner's or wrong-context id → **404**; a payment or a charge of a non-`forAccountant`
   account → **400**.
3. **Already-sent charge** — re-marking is idempotent and keeps the original
   `sentToAccountantAt`.
4. **Undo** — a per-charge **"Mark as unsent"** on the provider detail page clears the mark.
5. **Archived provider account** — included in exports; mark sent / unsent is **allowed**
   (hand-off metadata, not a ledger edit) — an explicit exception to the archived read-only
   rule; create / edit / delete of its transactions stay 409.

**What is exported**

6. **`forAccountant` turned off** after charges were sent — marks are kept, the account leaves
   future exports; turned back on, it returns and its sent charges stay sent.
7. **Positive transactions** (payments, provider refunds) are never exported. A refund and a
   payment are both positive and indistinguishable on the ledger (no `kind` column), so refunds
   are reported to the accountant outside Ward for now. Telling them apart is a use case of the
   *Categories* Future epic (see [Refunds](#refunds)).
8. **Mixed currencies** — a currency column per CSV row; any totals on the page are per
   currency, never summed.
9. **Empty range** — the CSV has just the header row; Mark as sent is disabled; an empty id
   list posted to the API → **400**.
10. **Invalid range** — `from` after `to`, a missing date or a future date → **400**. "Last
    full month" is computed from the browser's local date; the API receives explicit dates.

**Account and ledger**

11. **Charge edited / deleted after being sent** — warned (see above); an edit keeps the mark.
12. **Charge differs from `expectedAmount`** — not validated (a suggestion only).
13. **Archive / delete** — `regular.md` rules unchanged; `type` stays fixed; sent marks do not
    block deletion.
14. **Name uniqueness** — provider accounts count in the per-owner, case-insensitive rule like
    every type.

Security edge cases (CSV formula injection, range-size limits) are under Performance &
security.

### Routes and caching

All routes live under `<base>` of `regular.md` (both contexts) and follow
[regular.md Rules](../specs/banking/accounts/regular.md#rules).

**Account routes — reuse the generic ones** (debt / investment pattern; no `/providers.json`):

- `GET /accounts.json?type=provider_expense` lists them; `POST` / `PATCH /accounts…` accept a
  nested **`provider_expense`** object (`snake_case`): `for_accountant`, `provider_tax_id`,
  `expected_amount` (decimal string, as every amount), `charge_frequency`, `due_day`,
  `due_month`; detail and list rows carry it; unset fields are `null`.
- Validation as debt: the object on another type → 400; `due_month` required when yearly,
  rejected when monthly; out-of-range values → 400; unknown keys rejected by the whitelist.
- Transactions use the generic routes of `transactions.md`; responses include
  `sent_to_accountant_at` **only** for charges of provider-expense accounts.

**Hand-off routes (new):**

| Method | Route | Purpose | Cache class |
|---|---|---|---|
| GET | `/accountant/charges.json?from=&to=&include_sent=false` | Preview: charges of every `forAccountant` account of the active owner (archived included) in the range; rows: id, date, provider (account name + `bank_name`), `provider_tax_id`, description, amount, currency, `sent_to_accountant_at` | `user-scoped` |
| POST | `/accountant/mark-sent.json` | Body `{ "transaction_ids": [...] }`; all-or-nothing, idempotent | `never` |
| POST | `/accountant/mark-unsent.json` | Same body; clears the mark (the detail page's per-charge undo sends one id) | `never` |

**CSV built client-side** from the preview response — exactly the previewed ids by
construction, no CSV route, no backend memory, no new dependency, and the API stays
`.json`-only. Rejected: a server `GET …/charges.csv` (re-queries and may drift from the
preview unless it takes ids; breaks the `.json` convention; download headers). Formula-injection
escaping is therefore a frontend rule (see Performance & security).

**Caching:** `GET` routes are `user-scoped` (`@CachePolicy`, `X-Skip-Cache`); writes are
`never`; nothing goes into Navi's warm-up, no exception for the hand-off route — personal
routes carry no owner in the URL, so they **must** stay user-scoped.

**Rules:** 404 never 403; no owner fields in responses; bodies never accept `userId`,
`organizationId` or `sentToAccountantAt` (set only through the hand-off routes).

### Performance & security

**Security**

1. **CSV formula injection** (frontend, since the CSV is built client-side): **text** cells
   (provider name, `bank_name`, `provider_tax_id`, description) starting with `=`, `+`, `-`,
   `@`, tab or carriage return get a leading `'` (OWASP); the numeric **amount** column is not
   prefixed (negative amounts start with `-`). Every field is quoted, embedded quotes doubled.
2. **CSV format** — UTF-8 **with BOM** (accents in Excel), comma-separated, `.` decimal point,
   ISO dates; filename `ward-accountant-<from>-<to>.csv` (no owner or organization name).
3. **Ownership in the mark routes** — all ids resolved in **one query** joined to
   `bank_accounts` and filtered by the active owner; any unresolved id → 404 (all-or-nothing);
   the 400 cases (payments, non-`forAccountant` charges) in the same pass; the update in one DB
   transaction.
4. **Unchanged** — no owner fields in responses; whitelisted bodies, never logged; XSS
   escaping; no credentials; `provider_tax_id` shown in full, `account_number` masked in lists;
   **no rate limit** (authenticated users acting in their own context, as transactions).

**Performance**

5. **Range cap** — `to − from` ≤ **366 days**, else 400.
6. **Row / id caps** — the preview returns at most **1000** charges (ordered by date, then id);
   more → **400** ("narrow the range"), so a hand-off is never silently partial.
   `transaction_ids` ≤ **1000**, duplicates de-duplicated.
7. **Indexes** — the preview walks the owner's `forAccountant` accounts (owner index on
   `bank_accounts` + the details table), then their charges by `(account_id, date)`; no new
   index for `sent_to_accountant_at`. The charge walk is served by the existing
   `bank_transactions (account_id, date, id)` index of `transactions.md` (#29) — no new index;
   the `id` suffix also gives the preview's date-then-id order for free.
8. **Mark update** — one `UPDATE … WHERE id IN (…) AND sent_to_accountant_at IS NULL`
   (idempotent, keeps the original timestamp).

### Required tests

`regular.md` holds the full owner-context matrix; `provider-expense.md` lists only what is
specific to provider-expense accounts.

- **Account routes**
  - Provider routes follow the `regular.md` owner-context matrix in both contexts.
  - `type=provider_expense` lists only provider accounts; they never appear in the main
    Accounts list, Debts or Investments.
  - Create / read / PATCH the `provider_expense` object: `for_accountant` defaults to `true`;
    unset fields → `null`; PATCH merges partially.
  - 400 on: the object on another type; `due_month` missing when yearly / present when monthly;
    `due_day` / `due_month` out of range; `expected_amount` ≤ 0, over the bound or with wrong
    decimals; `provider_tax_id` over 32; unknown keys.
  - Name uniqueness: clashes with an active account of any type of the same owner → 409.
- **Transactions**
  - `sent_to_accountant_at` present only on charges of provider-expense accounts, absent
    elsewhere.
  - A transaction body with `sentToAccountantAt` / `sent_to_accountant_at` → 400.
- **Hand-off preview**
  - Returns only **charges** (never payments) of `forAccountant` accounts of the **active
    owner**: archived accounts included; unflagged accounts, other owners and the other context
    excluded.
  - `include_sent=false` hides sent charges; `true` shows them.
  - 400 on `from` after `to`, a missing date, a future date, a range over 366 days, or more than
    1000 rows; an empty range → empty list.
  - Mixed currencies: each row carries its own currency.
  - Works in both contexts; non-member `:orgId` → 404.
- **Mark sent / unsent**
  - Stamps exactly the posted ids, not others in the range.
  - Idempotent: re-marking keeps the original timestamp.
  - All-or-nothing: an unknown / other-owner / wrong-context id → 404, a payment or an unflagged
    charge → 400, and nothing is stamped in either case.
  - An empty list → 400; more than 1000 ids → 400; duplicates are de-duplicated.
  - Allowed on an archived account, while transaction create / edit / delete there stay 409.
  - Unsent clears the mark; the charge reappears in an unsent-only preview.
  - `forAccountant` turned off keeps the marks and drops the account from the preview.
  - Editing a sent charge keeps its mark; deleting it works.
- **DB**
  - `bank_provider_expense_details` is 1:1 with the account.
  - No owner columns exist outside `bank_accounts`.
- **UI**
  - Providers submenu: List, Detail (Add charge / Add payment shortcuts) and Create / Edit.
    Add charge pre-signs negative and suggests `expectedAmount`; Add payment pre-signs
    positive.
  - Hand-off page:
    - the range defaults to the last full month; "unsent only" is on by default;
    - the preview list renders;
    - Download CSV produces exactly the previewed rows;
    - Mark as sent is disabled on an empty preview.
  - CSV generation: formula-injection escaping on text cells, negative amounts untouched,
    quote / comma escaping, BOM, filename format.
  - Editing or deleting a sent charge shows a warning; Mark as unsent is on the detail page.
  - Pages render under both `/bank/providers…` and `/orgs/:orgId/bank/providers…`.
  - `ui/menu.md`: the **Providers** entry is shown; switching context lands on the Providers
    list.

### Owning module, data sensitivity, memory, compatibility

- **Owning module** — `bank` (lazy tier), no new module; depends on `auth` only through
  `@OwnerScoped()`, as `regular.md`.
- **Data sensitivity & ownership** — provider-expense accounts, their details and their charges
  inherit the owner from the account and follow
  [regular.md](../specs/banking/accounts/regular.md#data-sensitivity--ownership): in Personal
  only the owner, in an organization every member; Ward's `is_admin` sees neither. Financial
  data: masked account number in lists, bodies never logged.
- **Memory footprint** — negligible: no new dependency, the CSV is built in the browser, the
  preview is capped at 1000 rows.
- **Backward compatibility** — none: documentation only, nothing is implemented yet; the new
  `sent_to_accountant_at` column is nullable.

### Sequencing

- #41 has landed (PR #43), so this issue is unblocked.
- It may run in parallel with #33: #32 never edits `bills.md` / `ui/calendar.md`, and the
  README rows merge trivially.
- Agents: architect (documentation); consult `product-owner`.

## Benefits

- Provider expenses and the accountant hand-off are specified before implementation, on the
  same ledger, routes and owner rules as every other account type.
