# Issue: Enhance the banking specs: debt accounts

## Description

Part of Epic #26 (Bank module). Ward's first domain module, `bank` (lazy tier), tracks bank accounts, business expenses for the accountant and bills to pay, scoped to **organizations**. The feature follows the spec lifecycle in `docs/agents/specs.md`: specs are written under `docs/agents/specs/banking/` first, refined by enhancement sub-issues, then implemented, folded into the permanent docs and removed.

This sub-issue **refines the specs**: it turns the `accounts/debt.md` stub written by the initial-specs sub-issue (#27) into an agreed definition. It is documentation-only — no code.

### Depends on

The initial-specs sub-issue (#27) and the regular-accounts / transactions specs (#29), whose common account fields, ledger, opening anchor, currency and generic routes debt accounts reuse. Can run in parallel with the other spec-enhancement sub-issues.

## Problem

`accounts/debt.md` records only that a debt account is an `Account` with `type` `debt`, belongs to an organization and is not in the main accounts list. It leaves open what a debt tracks, how payments are recorded, whether instalments generate bills, where debts are listed (and whether they share a submenu with provider-expense accounts), and the routes, permissions and cache class. The implementation sub-issues of #26 and the bills spec (#33) need these settled.

## Expected Behavior

Rewrite `docs/agents/specs/banking/accounts/debt.md` with the agreed decisions below, and:

- update the **Debt accounts** row of `docs/agents/specs/banking/ui/menu.md` (own "Debts" submenu, status *Specified*; only that row, plus the matching open question);
- update the `accounts/debt.md` entry of the `docs/agents/specs/banking/README.md` index, and add a **Credit card accounts** entry to its `## Future epics`;
- resolve the debt-side open questions of `accounts/debt.md` (and point the `bills.md` question to #33).

`debt.md` keeps the **Reference** and **Required tests** sections required by `docs/agents/specs.md`; its Required tests cover the decisions below (fields and validation, the `debt` object on the generic routes, amount-owed sign handling, archived read-only, cascade delete, cross-type name uniqueness, wrong-type redirects, Debts pages and shortcuts).

## Solution

Agreed decisions (from the enhancement dialogue), to be written into the specs.

### Scope

**In scope** (documentation only, in `docs/agents/specs/banking/accounts/debt.md`):

- the fields specific to debt accounts, on top of the common account fields of
  `accounts/regular.md` (#29);
- how a debt's balance and ledger work, and what "paid off" means;
- how payments against a debt are recorded;
- the Debt accounts pages (list, detail, create / edit) and the Debt row in `ui/menu.md`;
- proposing whether debt and provider-expense accounts share one submenu (#32 confirms);
- routes, permissions and cache class;
- the `docs/agents/specs/banking/README.md` index entry and any new Future epics.

**Out of scope:**

- **Linked transfers** — paying a debt from a regular account as one linked operation stays in
  the existing *Linked transfers* Future epic; until then a payment is two manual transactions.
- **Bill generation** — whether instalments create bills is decided by #33; #30 only records
  what a debt exposes (e.g. instalment amount, due day) so #33 can use it.
- **Interest automation** — the interest rate is informational only: no automatic accrual, no
  amortization schedule (Price / SAC) and no projected payoff. Interest is entered as a
  transaction when it is charged.
- **Credit cards** — revolving accounts with statement cycles do not fit the debt shape; they
  are deferred to a Future epic.
- **Currency conversion and categories** — already deferred Future epics.

### What a debt account tracks

A debt account models a **loan**: a regular ledger (the one of `accounts/transactions.md`, #29)
that usually starts negative and moves towards zero.

- **Opening anchor** = the amount borrowed, as a negative balance on the loan date (e.g.
  `-10 000,00`). The opening balance is **not** forced to be negative: zero or positive is
  allowed (e.g. recording starts after the debt was partly paid, or a correction).
- **Payments** are positive transactions; **interest** is entered manually as negative
  transactions when charged — nothing is accrued automatically.
- **Paid off** is simply a balance of `0`. Nothing special happens at zero for now: no badge,
  no archive suggestion, no automatic action (archiving stays the manual action of
  `accounts/regular.md`).
- **Overpayment is allowed**: the balance may go positive (refunds, corrections), with no block
  and no warning.

#### Fields

All common account fields of `accounts/regular.md` apply. `bankName` is reused as the
**creditor** (labelled "Creditor" in the debt UI) — no separate `creditor` field. The original
amount and start date are the opening anchor (`openingBalance` / `openingDate`) — no separate
`principal` or `startDate`.

Debt-specific fields, all optional, stored in a 1:1 table `bank_debt_details` keyed by
`account_id` (so other account types carry no debt columns):

| Field | Type | Notes |
|---|---|---|
| `interestRate` | decimal (e.g. `1.99`) | Informational: the rate to apply when entering interest. |
| `interestPeriod` | `monthly` \| `yearly` | Required when `interestRate` is set. |
| `instalmentAmount` | BIGINT minor units, > 0 | Expected payment per instalment; available to #33 for bills. |
| `dueDay` | int 1–31 | Day of the month an instalment is due; 29–31 clamp to the month's last day. Available to #33. |
| `instalmentFrequency` | `monthly` \| `yearly` | Defaults to `monthly`. |
| `dueMonth` | int 1–12 | Month an instalment is due; required when `instalmentFrequency` is `yearly`, unset otherwise. |
| `instalmentCount` | int ≥ 1 | Informational total number of instalments; empty = open-ended. |

#### Credit cards

Credit cards use the same ledger mechanics (purchases negative, payments positive, positive
balances allowed) but are revolving and start at zero. They are a **separate future `type`**
(e.g. `credit_card`), deferred to a Future epic — not part of `debt`.

### Recording payments

- A debt's transactions are the generic `Transaction` entity and use the generic transaction
  routes of `accounts/transactions.md` (#29) — no debt-specific transaction entity or routes.
- **No `kind` column** (payment / interest / fee): the sign and the description are enough.
  Classifying transactions is left to the *Categories* Future epic.
- **UI shortcuts** on the debt detail page, purely frontend (the backend receives an ordinary
  transaction):
  - **Add payment** — opens the inline add form with a positive amount and the description
    prefilled as "Payment"; when `instalmentAmount` is set, it is suggested as the amount.
  - **Add interest** — opens the inline add form with a negative amount and the description
    prefilled as "Interest".
  - The plain inline add of #29 stays available.
- **No principal / interest split.** An instalment the bank reports as "500 = 120 interest +
  380 principal" is recorded as an interest transaction `-120` plus a payment `+500`; the
  resulting balance is the same.
- **Paying from a regular account** is two independent manual transactions (e.g. `-500` on the
  regular account, `+500` on the debt). Linking them is the *Linked transfers* Future epic.

### Instalments and bills

Whether and how debt instalments become bills on the Calendar is **left entirely to #33**
(`bills.md`). `debt.md` only lists what a debt exposes for it:

- `instalmentAmount`, `instalmentFrequency` (`monthly` | `yearly`), `dueDay`, `dueMonth`
  (yearly only) and `instalmentCount`;
- the computed balance, the opening date and the archived state.

This issue stores no bill rows and no schedule. The balance reaching zero (or going positive) is
**not** a stop condition for anything — consistent with "nothing special at zero".

### Debts submenu UI

Debt accounts get their **own "Debts" submenu** in the Bank menu — not shared with
provider-expense accounts (#32 may still propose merging). The Debt row of `ui/menu.md` is
updated accordingly. Pages live under the active organization, `/orgs/:orgId/bank/debts…`,
and mirror the Accounts pages of `accounts/regular.md`.

#### List — `/orgs/:orgId/bank/debts`

- `debt` accounts only. Columns: name, creditor, current balance, instalment amount with its
  frequency (e.g. "500,00 / month"), interest rate with its period (e.g. "1.99% / month"),
  currency. **No grand total.**
- Sorted by name; no pagination; *Show archived* toggle; **New debt** button.
- Empty state: "No debts yet" with a create button. A row opens the detail page.

#### Detail — `/orgs/:orgId/bank/debts/:accountId`

- As the regular account detail (header, actions, archived banner, paginated ledger with
  inline add / edit), plus a debt info block: interest rate and period, instalment amount,
  frequency, due day / month, instalment count.
- **Add payment** / **Add interest** shortcuts above the ledger (see Recording payments).

#### Create / Edit — `/orgs/:orgId/bank/debts/new`, `/orgs/:orgId/bank/debts/:accountId/edit`

- Common fields, with "Bank" relabelled **Creditor**; the opening date labelled **Loan date**;
  the opening balance labelled **Amount owed**.
- **Amount owed is typed positive and stored negated**: typing `10 000,00` stores an opening
  balance of `-10 000,00`. The UI always negates the value both ways (typing a negative amount
  owed stores a positive opening balance, for a debt already in credit). The API itself
  receives and returns the signed `opening_balance`.
- Debt fields: interest rate (the interest period appears once a rate is entered), instalment
  amount, frequency, due day, due month (shown only for `yearly`), instalment count.
- `type` is not shown — always `debt` from this submenu.

### Routes, permissions and caching

Debts **reuse the generic account routes** of `accounts/regular.md` (#29) — no `/debts.json`
routes, so archive / delete logic is not duplicated. Debt-specific data travels as a nested
`debt` object.

| Method | Route | Change for debts |
|---|---|---|
| GET | `/accounts.json?type=debt&archived=false` | `type=debt` lists debts; each row carries its `debt` object |
| POST | `/accounts.json` | Now accepts `type: "debt"` with an optional `debt: {…}` object |
| GET | `/accounts/:accountId.json` | Includes `debt` for a debt account |
| PATCH | `/accounts/:accountId.json` | Accepts `debt: {…}`, merged partially; `type` stays immutable; on an archived debt only `name` is accepted (as #29) |
| DELETE, archive, unarchive | unchanged | Same rules as #29 |
| Transactions, settings | unchanged | Generic routes of `accounts/transactions.md` |

The `debt` object (`snake_case`): `interest_rate` (decimal string, e.g. `"1.99"`),
`interest_period`, `instalment_amount` (decimal string, as every amount), `instalment_frequency`,
`due_day`, `due_month`, `instalment_count`.

#### Validation

- A `debt` object on a non-debt account → 400.
- `interest_rate` and `interest_period` go together: one without the other → 400.
- `due_month` is required when `instalment_frequency` is `yearly` and rejected (400) when it is
  `monthly`.
- Ranges: `due_day` 1–31, `due_month` 1–12, `instalment_count` ≥ 1, `instalment_amount` > 0
  (and within the amount bound of #29), `interest_rate` 0–100 with at most 4 decimals.

#### Permissions and caching

Same as #29: 404 never 403 (misses indistinguishable), every organization member can do
everything (roles stored but not enforced), bodies whitelisted, `GET` routes `user-scoped`
(with `X-Skip-Cache`), writes `never`, nothing in Navi's warm-up.

### Edge cases

1. **Name uniqueness across types** — the #29 rule (unique within the organization,
   case-insensitive, among active accounts) applies across **all** account types: a regular
   "Nubank" and a debt "Nubank" clash (409).
2. **Switching frequency** — `yearly` → `monthly` clears `due_month` automatically;
   `monthly` → `yearly` without `due_month` → 400.
3. **Clearing optional fields** — send `null`; the rate is cleared by sending `interest_rate`
   and `interest_period` both `null`.
4. **No `debt` object on POST** — a debt account always gets a `bank_debt_details` row (all
   fields null), so reads never handle a missing row.
5. **Delete** — the details row is removed with the account (`ON DELETE CASCADE` on the 1:1
   table); otherwise the #29 rule applies (409 when the account has transactions).
6. **Archived debt** — read-only as in #29; the **Add payment** / **Add interest** shortcuts
   are hidden.
7. **Wrong-type deep links** — the frontend redirects a debt opened under
   `/bank/accounts/:id` to `/bank/debts/:id`, and a regular account opened under
   `/bank/debts/:id` to `/bank/accounts/:id`. `GET /accounts/:id.json` returns any type.
8. **Instalment amount larger than the amount owed** — allowed; no cross-field checks (nor
   between `instalment_count × instalment_amount` and the balance).
9. **`due_day` 29–31** — stored as given; clamping to the month's last day is applied by #33
   when building bills.
10. **Interest rate 0** — valid (interest-free loan); it still requires a period.

### Owning module

- **Module:** `bank` (lazy tier), as #29 — no new module.
- **Table:** one new table, `bank_debt_details`: `account_id` is both PK and FK to
  `bank_accounts` (`ON DELETE CASCADE`), plus the debt fields. It carries no
  `organization_id` of its own — the organization comes from the account.
- **Other modules:** only `auth`, through the existing `@OrgScoped()` guard behind its DI token,
  as #29. No new cross-module access or events.
- **Shape (implementation hint):** a debt-details part inside `bank`, called by the generic
  account service when `type = debt`; no separate controller, since the routes are generic.

#### Backward compatibility

Additive: a new table, a newly accepted `type` value and a nested `debt` object only present on
debt accounts. Regular accounts are unchanged. The only behaviour change is that
`POST /accounts.json` with `type: debt` no longer answers 400.

#### Memory footprint

Negligible: one small table in the already-lazy `bank` module, no new dependency.

### Data sensitivity & ownership

As #29: debt fields are financial data but not credentials — no extra masking or encryption;
request bodies are never logged. Debts belong to the organization; every member can see and
edit them until the permission-system Future epic.

## Benefits

- Loans can be tracked with the same ledger, opening anchor and routes as regular accounts — no duplicated logic.
- #33 gets a clear, minimal contract (instalment fields) to build bills on, without #30 pre-deciding the bill model.
- Credit cards are kept out of the debt shape and recorded as their own future type.
