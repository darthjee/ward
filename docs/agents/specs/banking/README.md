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

All bank data is scoped to **organizations**. Organizations belong to the `auth` module and are
specified in [specs/auth/](../auth/README.md) — a dependency that is implemented before any bank
entity.

## Decisions

- **`Account`** is the bank entity for every kind of account, with a `type`: `regular`, `debt`,
  `investment` or `provider_expense` (see [accounts/README.md](accounts/README.md)).
- **The main accounts list shows `regular` accounts only.** Debt and provider-expense accounts
  are seen in their own place.
- **The Bank menu** has **Accounts** (regular only), a place for **debt / provider-expense
  accounts** (the exact split is decided later) and a **Calendar** of upcoming bills (see
  [ui/menu.md](ui/menu.md)).
- **Bank data is scoped to organizations.** This changes the "every domain record belongs to
  exactly one user" rule in `product.md`. The rule is **specified** in
  [auth/organizations.md](../auth/organizations.md#data-ownership) (by
  [#28](https://github.com/darthjee/ward/issues/28)): every bank record carries a logical
  `organizationId`, every bank route lives under `/api/orgs/:orgId/bank/...` and applies
  `@OrgScoped()`. The fold issue of #26 applies the rule to `product.md`.
- **No separate `api/` or `security.md` yet.** Each concern file holds its own routes,
  permissions and cache class; they can be split out later.

## Index

Deferred concerns are collected in [Future epics](#future-epics).

| File | Concern |
|---|---|
| [accounts/README.md](accounts/README.md) | `Account` and its `type`, common concepts, main-list rule |
| [accounts/regular.md](accounts/regular.md) | Common account fields, regular accounts, name uniqueness, archive vs delete, account routes, Accounts submenu pages |
| [accounts/transactions.md](accounts/transactions.md) | Ledger, opening anchor, computed balances, `Transaction` entity, currency, transaction and settings routes |
| [accounts/debt.md](accounts/debt.md) | Debt accounts |
| [accounts/investment.md](accounts/investment.md) | Investment accounts |
| [accounts/provider-expense.md](accounts/provider-expense.md) | Provider-expense accounts, incl. business expenses for the accountant |
| [bills.md](bills.md) | Bill entity, recurrence, paying |
| [ui/menu.md](ui/menu.md) | Bank menu and its submenus |
| [ui/calendar.md](ui/calendar.md) | Calendar of upcoming bills |

## Sub-issue map

| Sub-issue | Files |
|---|---|
| [#27](https://github.com/darthjee/ward/issues/27) | this `README.md`, `accounts/README.md`, `ui/menu.md` (each sub-issue edits only its own row), the skeletons of every other file |
| [#28](https://github.com/darthjee/ward/issues/28) | [auth/organizations.md](../auth/organizations.md) — entities and routes, single owner, roles stored but not enforced, auto-created organization, active organization in the URL, data-ownership rule, security; this `README.md` (`## Future epics` only) |
| [#29](https://github.com/darthjee/ward/issues/29) | [accounts/regular.md](accounts/regular.md) — common account fields, archive vs delete, account routes, Accounts submenu; [accounts/transactions.md](accounts/transactions.md) — ledger, opening anchor, computed balances, `Transaction`, currency, transaction and settings routes; `ui/menu.md` (Accounts row); this `README.md` (index entries and `## Future epics`) |
| [#30](https://github.com/darthjee/ward/issues/30) | `accounts/debt.md` |
| [#31](https://github.com/darthjee/ward/issues/31) | `accounts/investment.md` |
| [#32](https://github.com/darthjee/ward/issues/32) | `accounts/provider-expense.md` |
| [#33](https://github.com/darthjee/ward/issues/33) | `bills.md`, `ui/calendar.md` |
| Implementation / fold / remove sub-issues of #26 (created later by the *Continue* split) | build against this folder; the fold handles both `specs/banking/` and `specs/auth/`, then they are removed |

## Implementation order

Rough order, refined when the implementation sub-issues are created:

1. Organizations ([specs/auth/](../auth/README.md)).
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
   with typed-name confirmation, soft delete or archive, or refusing while data exists. Closing
   is what makes the zero-organizations state reachable (the UI already handles it).
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
   — a transfer between two accounts of the organization recorded as one linked pair of
   transactions. Until then: two independent manual transactions. Must respect the
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
   `categoryId`, so existing transactions stay uncategorised with no backfill.
10. **Ledger filters** (from [accounts/transactions.md](accounts/transactions.md#ledger))
    — date range and text search on an account's ledger, keeping the running balance correct.

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Sub-issues: https://github.com/darthjee/ward/issues/27,
  https://github.com/darthjee/ward/issues/28, https://github.com/darthjee/ward/issues/29,
  https://github.com/darthjee/ward/issues/30, https://github.com/darthjee/ward/issues/31,
  https://github.com/darthjee/ward/issues/32, https://github.com/darthjee/ward/issues/33
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md
- Product decisions (`bank` module, data ownership): https://github.com/darthjee/ward/blob/main/docs/agents/product.md

## Required tests

None for this index; the tests are defined in each file listed in the [index](#index).
