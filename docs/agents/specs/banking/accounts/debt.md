# Debt accounts

> **Owned by [#30](https://github.com/darthjee/ward/issues/30).** Builds on
> [#29](https://github.com/darthjee/ward/issues/29): debt accounts reuse the common account
> fields, name uniqueness, archive vs delete and account routes of [regular.md](regular.md), and
> the ledger, opening anchor, currency and transaction routes of
> [transactions.md](transactions.md). This file adds only what is specific to debts.

## Summary

- A debt account models a **loan**: an `Account` with `type` `debt` (see
  [README.md](README.md)).
- It has exactly one owner — the user (Personal) or an organization — like every account, and
  its debt details inherit that owner from the account (see
  [regular.md](regular.md#data-sensitivity--ownership)).
- Debt accounts are **not** shown in the main **Accounts** list; they have their own **Debts**
  submenu in the Bank menu (see [ui/menu.md](../ui/menu.md) and
  [Debts submenu UI](#debts-submenu-ui)).
- A debt account carries the regular ledger of [transactions.md](transactions.md#ledger), which
  usually starts negative and moves towards zero.

## Scope

**In scope:** the debt-specific fields, how a debt's balance and ledger work, how payments are
recorded, the Debts submenu pages, routes / permissions / cache class, and what a debt exposes
for bills.

**Out of scope:**

- **Linked transfers** — paying a debt from a regular account as one linked operation stays in
  the *Linked transfers* [Future epic](../README.md#future-epics); until then a payment is two
  manual transactions.
- **Bill generation** — whether instalments create bills is decided by
  [#33](https://github.com/darthjee/ward/issues/33) in [bills.md](../bills.md); this file only
  records what a debt exposes (see [Instalments and bills](#instalments-and-bills)).
- **Interest automation** — the interest rate is informational only: no automatic accrual, no
  amortization schedule (Price / SAC) and no projected payoff. Interest is entered as a
  transaction when it is charged.
- **Credit cards** — revolving accounts with statement cycles do not fit the debt shape; see
  [Credit cards](#credit-cards) and the *Credit card accounts*
  [Future epic](../README.md#future-epics).
- **Currency conversion and categories** — already deferred
  [Future epics](../README.md#future-epics).

## Ledger and balance

- **Opening anchor** ([transactions.md](transactions.md#opening-balance-anchor-model)) = the
  amount borrowed, as a negative balance on the loan date (e.g. `-10 000,00`). The opening
  balance is **not** forced to be negative: zero or positive is allowed (e.g. recording starts
  after the debt was partly paid, or a correction).
- **Payments** are positive transactions; **interest** is entered manually as negative
  transactions when charged — nothing is accrued automatically.
- **Paid off** is simply a balance of `0`. Nothing special happens at zero for now: no badge, no
  archive suggestion, no automatic action (archiving stays the manual action of
  [regular.md](regular.md#archive-vs-delete)).
- **Overpayment is allowed** — the balance may go positive (refunds, corrections), with no block
  and no warning.

## Fields

All [common account fields](regular.md#common-account-fields) apply, plus the opening anchor.

- `bankName` is reused as the **creditor** (labelled "Creditor" in the debt UI) — no separate
  `creditor` field.
- The original amount and start date are the opening anchor (`openingBalance` /
  `openingDate`) — no separate `principal` or `startDate`.

Debt-specific fields, **all optional**, stored in a 1:1 table `bank_debt_details` keyed by
`account_id` (so other account types carry no debt columns):

| Field | Type | Notes |
|---|---|---|
| `interestRate` | decimal (e.g. `1.99`) | Informational: the rate to apply when entering interest. 0–100, at most 4 decimals |
| `interestPeriod` | `monthly` \| `yearly` | Required when `interestRate` is set, and only then |
| `instalmentAmount` | `BIGINT` minor units, > 0 | Expected payment per instalment; within the amount bound (10¹³ minor units) of [transactions.md](transactions.md#currency). Available to #33 for bills |
| `dueDay` | int 1–31 | Day of the month an instalment is due; 29–31 clamp to the month's last day (applied by #33). Available to #33 |
| `instalmentFrequency` | `monthly` \| `yearly` | Defaults to `monthly` |
| `dueMonth` | int 1–12 | Month an instalment is due; required when `instalmentFrequency` is `yearly`, unset otherwise |
| `instalmentCount` | int ≥ 1 | Informational total number of instalments; empty = open-ended |

### Credit cards

Credit cards use the same ledger mechanics (purchases negative, payments positive, positive
balances allowed) but are revolving and start at zero. They are a **separate future `type`**
(e.g. `credit_card`), deferred to the *Credit card accounts*
[Future epic](../README.md#future-epics) — not part of `debt`.

## Recording payments

- A debt's transactions are the generic `Transaction` entity and use the generic transaction
  routes of [transactions.md](transactions.md#routes) — no debt-specific transaction entity or
  routes.
- **No `kind` column** (payment / interest / fee): the sign and the description are enough.
  Classifying transactions is left to the *Categories* [Future epic](../README.md#future-epics).
- **UI shortcuts** on the debt detail page, purely frontend (the backend receives an ordinary
  transaction):
  - **Add payment** — opens the inline add form with a positive amount and the description
    prefilled as "Payment"; when `instalmentAmount` is set, it is suggested as the amount.
  - **Add interest** — opens the inline add form with a negative amount and the description
    prefilled as "Interest".
  - The plain inline add of [regular.md](regular.md#detail)
    stays available.
- **No principal / interest split.** An instalment the bank reports as "500 = 120 interest + 380
  principal" is recorded as an interest transaction `-120` plus a payment `+500`; the resulting
  balance is the same.
- **Paying from a regular account** is two independent manual transactions (e.g. `-500` on the
  regular account, `+500` on the debt). Linking them is the *Linked transfers*
  [Future epic](../README.md#future-epics).

## Instalments and bills

Whether and how debt instalments become bills on the Calendar is **left entirely to
[#33](https://github.com/darthjee/ward/issues/33)** ([bills.md](../bills.md)). A debt only
exposes, for it:

- `instalmentAmount`, `instalmentFrequency` (`monthly` | `yearly`), `dueDay`, `dueMonth`
  (yearly only) and `instalmentCount`;
- the computed balance, the opening date and the archived state.

No bill rows and no schedule are stored by debts. The balance reaching zero (or going positive)
is **not** a stop condition for anything — consistent with "nothing special at zero".

## Debts submenu UI

Debt accounts get their **own "Debts" submenu** in the Bank menu (see
[ui/menu.md](../ui/menu.md)) — not shared with provider-expense accounts
([#32](https://github.com/darthjee/ward/issues/32) may still propose merging). All pages live
under the active context, `<ui>/debts…` (see [regular.md](regular.md#routes-and-permissions)
for `<ui>`), and mirror the [Accounts submenu UI](regular.md#accounts-submenu-ui).

### List

`<ui>/debts`

- `debt` accounts only. Columns: name, creditor, current balance, instalment amount with its
  frequency (e.g. "500,00 / month"), interest rate with its period (e.g. "1.99% / month"),
  currency. Amounts formatted with `Intl` in the account's own currency. **No grand total.**
- Sorted by name; no pagination.
- *Show archived* toggle (archived rows marked); **New debt** button.
- Empty state: "No debts yet" with a create button.
- A row opens the detail page.

### Detail

`<ui>/debts/:accountId`

- As the [regular account detail](regular.md#detail): header,
  actions, archived banner, paginated ledger with inline add / edit.
- Plus a **debt info block**: interest rate and period, instalment amount, frequency, due day /
  month, instalment count.
- **Add payment** / **Add interest** shortcuts above the ledger (see
  [Recording payments](#recording-payments)); hidden on an archived debt.

### Create / Edit

`<ui>/debts/new`, `<ui>/debts/:accountId/edit`

- Common fields, with "Bank" relabelled **Creditor**, the opening date labelled **Loan date**
  and the opening balance labelled **Amount owed**.
- **Amount owed is typed positive and stored negated**: typing `10 000,00` stores an opening
  balance of `-10 000,00`. The UI always negates the value both ways (typing a negative amount
  owed stores a positive opening balance, for a debt already in credit; a stored
  `-10 000,00` is shown as `10 000,00`). The API itself receives and returns the signed
  `opening_balance`.
- Debt fields: interest rate (the interest period appears once a rate is entered), instalment
  amount, frequency, due day, due month (shown only for `yearly`), instalment count.
- `type` is not shown — always `debt` from this submenu.

## Routes and permissions

Debts **reuse the generic account routes** of [regular.md](regular.md#routes-and-permissions)
— no `/debts.json` routes, so archive / delete logic is not duplicated. Debt-specific data
travels as a nested `debt` object. All routes live under the same base path as
[regular.md](regular.md#routes-and-permissions) (`<base>`, both contexts).

| Method | Route | Change for debts | Cache class |
|---|---|---|---|
| GET | `/accounts.json?type=debt&archived=false` | `type=debt` lists debts; each row carries its `debt` object | `user-scoped` |
| POST | `/accounts.json` | Now accepts `type: "debt"` with an optional `debt: {…}` object | `never` |
| GET | `/accounts/:accountId.json` | Includes `debt` for a debt account | `user-scoped` |
| PATCH | `/accounts/:accountId.json` | Accepts `debt: {…}`, merged partially; `type` stays immutable; on an archived debt only `name` is accepted (as #29) | `never` |
| DELETE, archive, unarchive | unchanged | Same rules as [regular.md](regular.md#accounts) | `never` |
| Transactions, settings | unchanged | Generic routes of [transactions.md](transactions.md#routes) | as there |

The `debt` object (`snake_case`): `interest_rate` (decimal string, e.g. `"1.99"`),
`interest_period`, `instalment_amount` (decimal string in the account's currency exponent, as
every amount), `instalment_frequency`, `due_day`, `due_month`, `instalment_count`. Unset fields
are returned as `null`.

### Validation

- A `debt` object on a non-debt account (create or PATCH) → 400.
- `interest_rate` and `interest_period` go together: one without the other → 400.
- `due_month` is required when `instalment_frequency` is `yearly` and rejected (400) when it is
  `monthly`.
- Ranges → 400 when outside: `due_day` 1–31, `due_month` 1–12, `instalment_count` ≥ 1,
  `instalment_amount` > 0 (and within the amount bound and currency decimals of
  [transactions.md](transactions.md#currency)), `interest_rate` 0–100 with at most 4
  decimals.
- Unknown fields inside `debt` are rejected by the whitelist `ValidationPipe`.

### Permissions and caching

Same as [regular.md](regular.md#rules):

- **404, never 403** — misses (unknown, non-numeric, another owner's or wrong-context ids,
  non-member `:orgId`) are indistinguishable.
- **Permissions** — in Personal, only the owner; in an organization context, every member can
  do everything (roles are stored but not enforced).
- **Bodies** are whitelisted; never accepted: `userId`, `organizationId`, `accountId`, `type`
  on PATCH, computed fields.
- **Caching** — `GET` routes are `user-scoped` (declared with `@CachePolicy`, sent with
  `X-Skip-Cache`); writes are `never`. Nothing goes into Navi's warm-up.

## Data sensitivity & ownership

As [regular.md](regular.md#data-sensitivity--ownership): debt fields are financial data but not
credentials — no extra masking or encryption; request / response bodies are never logged.
Debts inherit the owner from their account; who sees and edits them follows
[regular.md](regular.md#data-sensitivity--ownership).

## Owning module

- **`bank`** (lazy tier), as [regular.md](regular.md#owning-module) — **no new module**.
- **Table** — one new table, `bank_debt_details`: `account_id` is both PK and real FK to
  `bank_accounts.id` (`ON DELETE CASCADE`, same module), plus the debt fields. It carries no
  owner columns — the owner comes from the account.
- **Other modules** — only `auth`, through the existing `@OwnerScoped()` guard behind its DI
  token. No new cross-module access and no events.
- **Shape (implementation hint)** — a debt-details part inside `bank`, called by the generic
  account service when `type = debt`; no separate controller, since the routes are generic.

### Backward compatibility

Additive: a new table, a newly accepted `type` value and a nested `debt` object present only on
debt accounts. Regular accounts are unchanged. The only behaviour change is that
`POST /accounts.json` with `type: debt` no longer answers 400 (the
[regular.md](regular.md#accounts) "until the other type specs exist" rule; reconciled by the
fold sub-issue of #26).

### Memory footprint

Negligible: one small table in the already-lazy `bank` module, no new dependency.

## Edge cases

1. **Name uniqueness across types** — the [#29 rule](regular.md#name-uniqueness) (unique within
   its owner — Personal or an organization —, case-insensitive, among active accounts) applies across **all** account
   types: a regular "Nubank" and a debt "Nubank" clash (409).
2. **Switching frequency** — `yearly` → `monthly` clears `due_month` automatically;
   `monthly` → `yearly` without `due_month` → 400.
3. **Clearing optional fields** — send `null`; the rate is cleared by sending `interest_rate`
   and `interest_period` both `null`.
4. **No `debt` object on POST** — a debt account always gets a `bank_debt_details` row (all
   fields null, `instalment_frequency` `monthly`), so reads never handle a missing row.
5. **Delete** — the details row is removed with the account (`ON DELETE CASCADE` on the 1:1
   table); otherwise the [#29 rule](regular.md#archive-vs-delete) applies (409 when the account
   has transactions).
6. **Archived debt** — read-only as in #29 (only rename and unarchive); the **Add payment** /
   **Add interest** shortcuts are hidden.
7. **Wrong-type deep links** — the frontend redirects a debt opened under
   `<ui>/accounts/:id` to `<ui>/debts/:id`, and a regular account opened under
   `<ui>/debts/:id` to `<ui>/accounts/:id`. `GET /accounts/:id.json` returns any type.
8. **Instalment amount larger than the amount owed** — allowed; no cross-field checks (nor
   between `instalment_count × instalment_amount` and the balance).
9. **`due_day` 29–31** — stored as given; clamping to the month's last day is applied by #33
   when building bills.
10. **Interest rate 0** — valid (interest-free loan); it still requires a period.

## Resolved questions

- [x] Whether debt and provider-expense accounts share one submenu — debts get their **own
  "Debts" submenu**; #32 may still propose merging (see [ui/menu.md](../ui/menu.md)).
- [x] Whether debts generate bills — decided by #33 in [bills.md](../bills.md); debts only
  expose the fields listed in [Instalments and bills](#instalments-and-bills).
- [x] Fields specific to debt accounts — see [Fields](#fields).
- [x] Routes, permissions and cache class — see [Routes and permissions](#routes-and-permissions).

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Skeleton sub-issue: https://github.com/darthjee/ward/issues/27
- Owning sub-issue: https://github.com/darthjee/ward/issues/30
- Common account fields, account routes and rules (#29): https://github.com/darthjee/ward/issues/29,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/regular.md
- Ledger, opening anchor, currency and transactions (#29): https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/transactions.md
- Bills (instalments): https://github.com/darthjee/ward/issues/33
- Provider-expense accounts (shared submenu question): https://github.com/darthjee/ward/issues/32
- Organizations, `@OwnerScoped()`, data-ownership rule: https://github.com/darthjee/ward/issues/28,
  https://github.com/darthjee/ward/issues/40,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/auth/organizations.md
- Bank ownership contract: https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/README.md#bank-ownership-contract
- Realignment to the ownership model: https://github.com/darthjee/ward/issues/41
- Cache classes (`user-scoped`, `never`, `X-Skip-Cache`): https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md

## Required tests

**Backend**

- Create: `type: "debt"` accepted, with or without a `debt` object; without it a
  `bank_debt_details` row is still created (all fields null, `instalment_frequency`
  `monthly`); common-field validation as in [regular.md](regular.md#required-tests).
- Validation → 400: a `debt` object on a non-debt account (create and PATCH);
  `interest_rate` without `interest_period` and vice versa; `instalment_frequency` `yearly`
  without `due_month`; `due_month` with `monthly`; `due_day` 0 / 32; `due_month` 0 / 13;
  `instalment_count` 0; `instalment_amount` 0, negative, over the amount bound or with more
  decimals than the currency allows; `interest_rate` negative, over 100 or with 5 decimals;
  unknown fields inside `debt`. Boundaries accepted: `due_day` 1 / 31, `due_month` 1 / 12,
  `instalment_count` 1, `interest_rate` 0 and 100, 4 decimals.
- The `debt` object is present (`snake_case`, amounts and rate as decimal strings, unset
  fields `null`) on list rows, the detail and the create / PATCH responses of debt accounts,
  and absent on regular accounts.
- PATCH merges `debt` partially (omitted fields unchanged); `null` clears a field; the rate is
  cleared with both `interest_rate` and `interest_period` `null`; `yearly` → `monthly` clears
  `due_month`; `type` rejected.
- `opening_balance` accepted negative, zero and positive; overpayment (a balance going positive)
  allowed, with no error.
- Archived debt: only `name` accepted on PATCH (any `debt` field → 409); transaction writes
  → 409 (as [transactions.md](transactions.md#required-tests)).
- Delete: a debt with no transactions is deleted together with its `bank_debt_details` row
  (`ON DELETE CASCADE`); with transactions → 409.
- Name uniqueness across types: a debt named like an active regular account (case-insensitive)
  → 409 on create, rename and unarchive.
- List: `type=debt` returns debt accounts only, sorted by name, archived hidden unless
  `archived=true`; the default (`regular`) list excludes debts; no N+1 for balances or details.
- `GET /accounts/:id.json` returns a debt account with its `debt` object.
- Unknown, non-numeric, another owner's and wrong-context `:accountId`, and a non-member
  `:orgId`, → 404 with identical bodies on every debt-related call.
- Debt routes follow the [regular.md owner-context matrix](regular.md#required-tests) in both
  contexts (`/api/bank` and `/api/orgs/:orgId/bank`).
- `GET` routes are `user-scoped` and send `X-Skip-Cache`; writes are `never`.
- Request / response bodies are not logged.

**Frontend**

- Debts list: columns name, creditor, balance, instalment amount with frequency, interest rate
  with period, currency; amounts formatted with `Intl`; no grand total; sorted by name;
  *Show archived* toggle; **New debt** button; empty state "No debts yet" with a create button;
  a row opens the debt detail.
- Debt detail: the debt info block; ledger as for regular accounts; **Add payment** opens the
  inline form with a positive amount, "Payment" prefilled and `instalmentAmount` suggested when
  set; **Add interest** opens it with a negative amount and "Interest" prefilled; the plain
  inline add stays; both shortcuts hidden on an archived debt.
- Create / Edit: labels Creditor, Loan date and Amount owed; amount owed typed positive is sent
  as a negative `opening_balance`, a typed negative is sent positive, and a stored balance is
  shown negated; the interest period appears only once a rate is entered; due month appears
  only for `yearly`; `type` is not shown.
- Wrong-type deep links: a debt opened under `<ui>/accounts/:id` redirects to
  `<ui>/debts/:id`, and a regular account opened under `<ui>/debts/:id` redirects to
  `<ui>/accounts/:id`, in both contexts.
- Debts pages render under both `/bank/debts...` and `/orgs/:orgId/bank/debts...`, with links
  built from the active context.
- The Bank menu shows the **Debts** entry, listing debt accounts only.
- Names, creditor, notes and descriptions are rendered escaped.
