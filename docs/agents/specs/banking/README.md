# Banking specs

> **Naming:** the spec folder is `banking`; the backend module is `bank`.

Feature specs for the **`bank` module** — Epic [#26](https://github.com/darthjee/ward/issues/26).
While this folder exists it is the source of truth for every bank decision; the sub-issues of #26
read it instead of deciding on their own. See [specs.md](../../specs.md) for the spec lifecycle.

## Purpose and scope

`bank` is Ward's first domain module (lazy tier). It tracks:

- bank accounts;
- business expenses, kept for the accountant;
- bills to pay.

Bank data belongs to **exactly one owner — either the user (personal) or an organization**.
Organizations belong to the `auth` module and are specified in [specs/auth/](../auth/README.md) —
a dependency that is still implemented before any bank entity, because `@OwnerScoped()` and the
organization routes are needed.

[#32](https://github.com/darthjee/ward/issues/32) and
[#33](https://github.com/darthjee/ward/issues/33) are written against the realigned specs
(after [#41](https://github.com/darthjee/ward/issues/41)).

## Decisions

- **`Account`** is the bank entity for every kind of account, with a `type`: `regular`, `debt`,
  `investment` or `provider_expense` (see [accounts/README.md](accounts/README.md)).
- **The main accounts list shows `regular` accounts only.** Debt, investment and
  provider-expense accounts are seen in their own place.
- **The Bank menu** has **Accounts** (regular only), **Debts** (debt accounts, their own
  submenu), **Investments** (investment accounts, their own submenu), **Providers** (provider-expense accounts, their own submenu) and a **Calendar** of
  upcoming bills (see [ui/menu.md](ui/menu.md)).
- **Bank data is user-or-organization-owned.** This changes the "every domain record belongs
  to exactly one user" rule in `product.md`. The generic rule is **specified** in
  [auth/organizations.md](../auth/organizations.md#data-ownership) (defined by
  [#28](https://github.com/darthjee/ward/issues/28), revised by
  [#40](https://github.com/darthjee/ward/issues/40), which made organizations optional); the
  bank-specific part is the [Bank ownership contract](#bank-ownership-contract) below. The fold
  issue of #26 applies the rule to `product.md`.
- **No separate `api/` or `security.md` yet.** Each concern file holds its own routes,
  permissions and cache class; they can be split out later.

## Bank ownership contract

- **Only `bank_accounts` stores the owner**: `user_id` and `organization_id` (entity properties
  `userId` / `organizationId`), both **nullable**, **logical** references to `auth` (no physical
  FK) and **indexed**. A DB **check constraint** requires **exactly one** of them to be set.
- **Child records** (transactions, `bank_debt_details`, `bank_investment_details`,
  `bank_provider_expense_details`, and later bill records) **inherit the owner through their account** and never
  store a copy.
- **Route prefixes**:
  - personal: API `/api/bank/...`, UI `/bank/...`;
  - organization: API `/api/orgs/:orgId/bank/...`, UI `/orgs/:orgId/bank/...`.

  The `bank` controllers are mounted under **both** prefixes, apply `@OwnerScoped()`, and serve
  the same logic (backend routes keep the `.json` suffix, e.g. `/api/bank/accounts.json`).
- **Account-name uniqueness is per owner**: the same name in Personal and in an organization is
  allowed.
- Moving money between a personal account and an organization account takes **two manual
  transactions**, as for any two accounts.
- Responses **never** contain `user_id` / `organization_id`. A wrong context (an organization
  account on a personal route, or the reverse) returns **404**, like an unknown id.
- All bank routes are **`user-scoped`** and send `X-Skip-Cache` (writes are `never`).

## Index

Deferred concerns are collected in [Future epics](#future-epics).

| File | Concern |
|---|---|
| [accounts/README.md](accounts/README.md) | `Account` and its `type`, common concepts, main-list rule |
| [accounts/regular.md](accounts/regular.md) | Common account fields, regular accounts, owner contexts (`<base>` / `<ui>`), per-owner name uniqueness, archive vs delete, account routes, owner-context test matrix, Accounts submenu pages |
| [accounts/transactions.md](accounts/transactions.md) | Ledger, opening anchor, computed balances, `Transaction` entity, currency, transaction routes, settings routes in both contexts |
| [accounts/debt.md](accounts/debt.md) | Debt accounts (loans): debt fields in `bank_debt_details`, ledger sign rules, payment / interest shortcuts, `debt` object on the generic account routes, Debts submenu pages |
| [accounts/investment.md](accounts/investment.md) | Investment accounts (one per investment): plain ledger whose balance is the current value, opening anchor fixed at 0, application / withdrawal / yield movements and the Update value shortcut, informational fields in `bank_investment_details`, `investment` object on the generic account routes, Investments submenu pages |
| [accounts/provider-expense.md](accounts/provider-expense.md) | Provider-expense accounts (one per provider): payable ledger (charges negative, payments positive), provider fields in `bank_provider_expense_details`, `provider_expense` object on the generic account routes, `sentToAccountantAt` on transactions, accountant hand-off (preview, client-side CSV, mark sent / unsent), Providers submenu pages |
| [bills.md](bills.md) | Bill entity, recurrence, paying |
| [ui/menu.md](ui/menu.md) | Bank menu and its submenus |
| [ui/calendar.md](ui/calendar.md) | Calendar of upcoming bills |

## Sub-issue map

| Sub-issue | Files |
|---|---|
| [#27](https://github.com/darthjee/ward/issues/27) | this `README.md`, `accounts/README.md`, `ui/menu.md` (each sub-issue edits only its own row), the skeletons of every other file |
| [#28](https://github.com/darthjee/ward/issues/28) | [auth/organizations.md](../auth/organizations.md) — entities and routes, single owner, roles stored but not enforced, auto-created organization, active organization in the URL, data-ownership rule, security; this `README.md` (`## Future epics` only) |
| [#29](https://github.com/darthjee/ward/issues/29) | [accounts/regular.md](accounts/regular.md) — common account fields, archive vs delete, account routes, Accounts submenu; [accounts/transactions.md](accounts/transactions.md) — ledger, opening anchor, computed balances, `Transaction`, currency, transaction and settings routes; `ui/menu.md` (Accounts row); this `README.md` (index entries and `## Future epics`) |
| [#30](https://github.com/darthjee/ward/issues/30) | [accounts/debt.md](accounts/debt.md) — debt fields (`bank_debt_details`), ledger and sign rules, recording payments, what debts expose for bills, `debt` object on the generic account routes, Debts submenu; `ui/menu.md` (Debts row); this `README.md` (index entry and `## Future epics`) |
| [#31](https://github.com/darthjee/ward/issues/31) | [accounts/investment.md](accounts/investment.md) — the investment model (ledger as current value, opening anchor 0, yield as transactions), investment fields (`bank_investment_details`), recording movements, `investment` object on the generic account routes, Investments submenu; `ui/menu.md` (Investments row); this `README.md` (index entry and `## Future epics`) |
| [#32](https://github.com/darthjee/ward/issues/32) | [accounts/provider-expense.md](accounts/provider-expense.md) — the provider-expense model (payable ledger per provider), provider fields (`bank_provider_expense_details`), recording charges and payments, business expenses for the accountant (hand-off routes, client-side CSV, mark sent / unsent), what providers expose for bills, `provider_expense` object on the generic account routes, Providers submenu; `accounts/transactions.md` (`sentToAccountantAt` row, body whitelist, attachments pointer); `ui/menu.md` (Providers row, shared-submenu question resolved); this `README.md` (decision bullet, index entry, sub-issue map row, `## Future epics`) |
| [#33](https://github.com/darthjee/ward/issues/33) | `bills.md`, `ui/calendar.md` |
| [#40](https://github.com/darthjee/ward/issues/40) | [auth/organizations.md](../auth/organizations.md) — optional organizations, active context, user-or-organization-owned rule, `@OwnerScoped()`; this `README.md` (scope, decision, ownership contract, realignment note, sub-issue map, `## Future epics`); [auth/README.md](../auth/README.md) |
| [#41](https://github.com/darthjee/ward/issues/41) | per-spec realignment to the ownership contract: `accounts/README.md`, `accounts/regular.md`, `accounts/transactions.md`, `accounts/debt.md`, `accounts/investment.md`, `ui/menu.md`; the one-line owner fix in `accounts/provider-expense.md` and `bills.md`; this `README.md` (realignment note, index entries, sub-issue map row, `## Future epics`) |
| Implementation / fold / remove sub-issues of #26 (created later by the *Continue* split) | build against this folder; the fold handles both `specs/banking/` and `specs/auth/`, then they are removed |

## Implementation order

Rough order, refined when the implementation sub-issues are created:

1. Organizations and the owner-context guard ([specs/auth/](../auth/README.md)).
2. Accounts and their types.
3. Bills and the calendar.

## Future epics

Every concern the bank and organization specs defer. These entries are **not** opened as GitHub
issues now: an epic is created for each of them before the specs are folded and removed (see
[specs.md](../../specs.md#lifecycle)). The other enhancement sub-issues (#29–#33) add their own
deferred concerns to this same list.

1. **Organization permission system** (from [auth/organizations.md](../auth/organizations.md#permissions))
   — enforce the `owner` / `admin` / `user` matrix (e.g. a `user` cannot delete bank data),
   member management and the role checks. Roles are already stored on
   `OrganizationMembership`, so the epic adds only rules, with no data migration. Ward's global
   `is_admin` must keep granting no organization access.
2. **Joining organizations** (from [auth/organizations.md](../auth/organizations.md#joining-an-organization))
   — invites by username or email, invite links and an accept step; invited members join as
   `user`. It also brings the actions that only make sense with several members: listing
   members, **leaving** (any member except the owner) and **transferring ownership**
   (owner-only; the target becomes `owner`, the previous owner becomes `user`). The
   [Ownership](../auth/organizations.md#ownership) rules are the target behaviour; exactly one
   owner at all times.
3. **Closing (deleting) organizations** (from [auth/organizations.md](../auth/organizations.md#ownership))
   — owner-only. The epic must decide what happens to the organization's data: hard delete
   with typed-name confirmation, soft delete or archive, or refusing while data exists. (Zero
   organizations is already the normal state since #40, so closing adds no new UI state.)
4. **Organization-creation rate limit** (from [auth/organizations.md](../auth/organizations.md#edge-cases))
   — cap the number of organizations created per user per time window through
   `POST /orgs.json`, configurable through env vars, answering 429 when exceeded. It is a
   volume limit, unlike the existing failure-based lockouts.
5. **Reconciliation** (from [accounts/transactions.md](accounts/transactions.md#opening-balance-anchor-model))
   — a per-transaction *cleared* flag to match the ledger against the bank statement,
   surfacing mismatches (e.g. a wrongly backfilled transaction absorbed by the opening anchor).
   Transactions stay editable and hard-deletable until it exists; the epic decides what a
   cleared transaction locks.
6. **Linked transfers** (from [accounts/transactions.md](accounts/transactions.md#transaction-entity))
   — a transfer between two accounts of the **same owner** recorded as one linked pair of
   transactions; cross-owner transfers stay two manual transactions. Until then: two
   independent manual transactions. Must respect the
   one-currency-per-account rule (no conversion without the currency-conversion epic).
7. **Counterparty / payee** (from [accounts/transactions.md](accounts/transactions.md#transaction-entity))
   — a field recording who paid or was paid.
8. **Currency conversion** (from [accounts/transactions.md](accounts/transactions.md#currency))
   — FX rates and an organization base currency, so totals across accounts in different
   currencies can be shown together. Until then aggregates are grouped per currency, never
   summed; amounts stay integer minor units in each account's own currency.
9. **Categories** (from [accounts/transactions.md](accounts/transactions.md#categories))
   — categorising transactions: scope, entity, management UI, hierarchy and income/expense kind
   are decided by the epic. Likely shared with bills ([#33](https://github.com/darthjee/ward/issues/33))
   and provider expenses ([#32](https://github.com/darthjee/ward/issues/32)). Adds a nullable
   `categoryId`, so existing transactions stay uncategorised with no backfill. One use case
   (from [accounts/provider-expense.md](accounts/provider-expense.md#refunds)): telling a
   provider refund apart from a payment, so it can be exported to the accountant as a negative
   business expense.
10. **Ledger filters** (from [accounts/transactions.md](accounts/transactions.md#ledger))
    — date range and text search on an account's ledger, keeping the running balance correct.
11. **Credit card accounts** (from [accounts/debt.md](accounts/debt.md#credit-cards))
    — a separate account `type` (e.g. `credit_card`) for revolving accounts with statement
    cycles. Same ledger mechanics as debts (purchases negative, payments positive, positive
    balances allowed) but starting at zero. The epic decides statement cycles, closing / due
    dates and how card statements relate to bills ([#33](https://github.com/darthjee/ward/issues/33)).
    Must respect the one-currency-per-account rule.
12. **Investment valuation history** (from [accounts/investment.md](accounts/investment.md#alternatives-considered))
    — value snapshots over time and performance charts / returns for investment accounts. The
    ledger balance stays the single source of truth for the current value (no overwritable
    `currentValue` field), one account stays one investment, and the one-currency-per-account
    rule applies. Per-asset tracking (tickers, quantities, prices) stays out of scope unless the
    epic chooses to include it.
13. **Move an account between owners** (from [Bank ownership contract](#bank-ownership-contract))
    — reassign an account and its child records from Personal to an organization or back. Must
    keep the exactly-one-owner check and per-owner name uniqueness.
14. **Share a personal record with an organization** (from [Bank ownership contract](#bank-ownership-contract))
    — give organization members access to a personal record without changing its owner. Must
    keep "personal data is private" as the default, and keep owner fields out of responses.
15. **Authorship / audit trail** (from [accounts/regular.md](accounts/regular.md#data-sensitivity--ownership))
    — record which member created or changed a record in an organization, without changing the
    single-owner rule (the user reference carries no owner semantics). The `createdByUserId`
    planned by #29 was dropped by #41, so there is no `created_by` column until this epic.
16. **Receipts / attachments** (from [accounts/provider-expense.md](accounts/provider-expense.md#receipts--attachments))
    — attach receipt files to transactions (charges) and include them in the accountant
    hand-off. The epic decides storage (Render has no persistent disk on the free tier), size
    limits, allowed types and access (attachments inherit the owner through their
    transaction's account, like every child record).
17. **PDF accountant export** (from [accounts/provider-expense.md](accounts/provider-expense.md#receipts--attachments))
    — a PDF alongside the CSV accountant hand-off. Deferred because of the heavy library and
    its memory cost on the 512 MB free tier.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Sub-issues: https://github.com/darthjee/ward/issues/27,
  https://github.com/darthjee/ward/issues/28, https://github.com/darthjee/ward/issues/29,
  https://github.com/darthjee/ward/issues/30, https://github.com/darthjee/ward/issues/31,
  https://github.com/darthjee/ward/issues/32, https://github.com/darthjee/ward/issues/33,
  https://github.com/darthjee/ward/issues/40, https://github.com/darthjee/ward/issues/41
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md
- Product decisions (`bank` module, data ownership): https://github.com/darthjee/ward/blob/main/docs/agents/product.md

## Required tests

None for this index; the tests are defined in each file listed in the [index](#index).
