# Investment accounts

> **Owned by [#31](https://github.com/darthjee/ward/issues/31).** Builds on
> [#29](https://github.com/darthjee/ward/issues/29): investment accounts reuse the common account
> fields, name uniqueness, archive vs delete and account routes of [regular.md](regular.md), and
> the ledger, opening anchor, currency and transaction routes of
> [transactions.md](transactions.md). The type-specific fields follow the 1:1 details-table
> pattern of [debt.md](debt.md) ([#30](https://github.com/darthjee/ward/issues/30)). This file
> adds only what is specific to investments.

## Summary

- An investment account is an `Account` with `type` `investment` (see
  [README.md](README.md)).
- **One investment account = one investment** (e.g. a specific CDB or fund). A broker holding
  several assets is modelled as several investment accounts.
- It belongs to an organization (see
  [auth/organizations.md](../../auth/organizations.md#data-ownership)), never directly to a user.
- Investment accounts are **not** shown in the main **Accounts** list (which stays `regular`
  only); they have their own **Investments** submenu in the Bank menu (see
  [ui/menu.md](../ui/menu.md) and [Investments submenu UI](#investments-submenu-ui)).
- An investment account is a **plain ledger**, the same shape as regular and debt accounts: its
  balance (opening anchor + transactions, see [transactions.md](transactions.md#ledger)) **is**
  the investment's current value.

## Scope

**In scope:** the investment model (ledger as current value), the investment-specific fields,
how applications, withdrawals and yield are recorded, the Investments submenu pages, routes /
permissions / cache class.

**Out of scope:**

- **Per-asset tracking** — tickers, quantities and prices are not modelled; one account is one
  investment.
- **Valuation history and performance charts** — value snapshots over time and return charts
  are deferred to the *Investment valuation history*
  [Future epic](../README.md#future-epics).
- **Automated yield** — yield is entered manually as a transaction; nothing is accrued or
  fetched automatically.
- **Structured yield indexes** — no CDI / IPCA / … fields; indexed yields are described in
  `notes` (see [Fields](#fields)).
- **Tax / fee handling** — no special support; taxes and fees are ordinary negative
  transactions (see [Recording movements](#recording-movements)).
- **Linked transfers** — moving money between a regular account and an investment as one linked
  operation stays in the *Linked transfers* [Future epic](../README.md#future-epics).
- **Currency conversion** — already a deferred [Future epic](../README.md#future-epics).

## Ledger and balance

- **Opening anchor** ([transactions.md](transactions.md#opening-balance-anchor-model)) is
  **forced to 0**: an investment always starts empty. `openingBalance` must be `0` — a non-zero
  value is a 400, on create and on PATCH. Only `openingDate` (the start date) matters.
- The **initial amount invested** is recorded as the first **Application** transaction, so every
  money-in shows in the ledger.
- **Applications** (money in) are positive transactions; **withdrawals** (money out) are
  negative transactions.
- **Yield** is recorded manually as a transaction described "Yield": positive for gains,
  negative for losses — mirroring manual interest on [debt accounts](debt.md#ledger-and-balance).
  No automation.
- A **negative balance is allowed**, with no warning (same as the other account types).

### Alternatives considered

- **A separate, overwritable `currentValue` field** — rejected: two sources of truth (field vs
  ledger) and no history of how the value changed.
- **A valuation-history table** (periodic value snapshots) — rejected for now: it needs a new
  table and routes. Deferred to the *Investment valuation history*
  [Future epic](../README.md#future-epics).

## Fields

All [common account fields](regular.md#common-account-fields) apply, with these adjustments:

- `bankName` is reused as the **institution / broker** (labelled "Institution" in the
  investment UI) — no separate `institution` field.
- `openingBalance` is always `0` (see [Ledger and balance](#ledger-and-balance));
  `openingDate` is the start date.
- **No structured index fields**: indexed or otherwise complex yields ("110% CDI",
  "IPCA + 5%") go in the account's existing free-text `notes`, so users can describe their
  product freely.

Investment-specific fields, **all optional and informational only** (never used in any
computation), stored in a 1:1 table `bank_investment_details` keyed by `account_id` (so other
account types carry no investment columns):

| Field | Type | Notes |
|---|---|---|
| `kind` | `fixed_income` \| `fund` \| `stocks` \| `savings` \| `pension` \| `crypto` \| `other` | Kind of product |
| `yieldRate` | decimal (e.g. `12.5`) | For fixed-rate products. 0–100, at most 4 decimals |
| `yieldPeriod` | `monthly` \| `yearly` | Required when `yieldRate` is set, and only then |
| `maturityDate` | date | When the investment matures; may be in the past |
| `liquidityDays` | int ≥ 0 | D+N redemption delay; `0` = daily liquidity |

## Recording movements

- An investment's transactions are the generic `Transaction` entity and use the generic
  transaction routes of [transactions.md](transactions.md#routes) — no investment-specific
  transaction entity or routes.
- **No `kind` column** (application / withdrawal / yield): the movement type is conveyed by the
  sign and the description only.
- **UI shortcuts** on the investment detail page, purely frontend (the backend receives an
  ordinary transaction); each pre-fills the transaction form:
  - **Add application** — a positive amount, description prefilled as "Application".
  - **Add withdrawal** — the amount is typed **positive** and stored **negative**, description
    prefilled as "Withdrawal".
  - **Update value** — the user types the broker's current value; the UI computes
    `currentValue − balance` and creates a "Yield" transaction for the difference (positive or
    negative). If the difference is `0`, no transaction is created and the UI shows
    "Value unchanged". No new route — it posts a regular transaction.
  - The plain inline add of [regular.md](regular.md#detail--orgsorgidbankaccountsaccountid)
    stays available.
- **Moving money from a regular account** into an investment (or back) is two independent
  manual transactions, one on each account. Linking them is the *Linked transfers*
  [Future epic](../README.md#future-epics).
- **Taxes and fees** get no special support: the user records them as negative transactions,
  either folded into the yield or with a free description (e.g. "IR", "Fee").

## Investments submenu UI

Investment accounts get their **own "Investments" submenu** in the Bank menu (see
[ui/menu.md](../ui/menu.md)). All pages live under the active organization,
`/orgs/:orgId/bank/investments…`, and mirror the
[Accounts submenu UI](regular.md#accounts-submenu-ui) and the
[Debts submenu UI](debt.md#debts-submenu-ui).

### List — `/orgs/:orgId/bank/investments`

- `investment` accounts only. Columns: name, institution, kind, current value (balance), yield
  rate with its period (e.g. "1.1% / month"), maturity date, currency. Amounts formatted with
  `Intl` in the account's own currency. **No total row** (currencies may differ; same as
  Debts).
- Sorted by name; no pagination.
- *Show archived* toggle (archived rows marked); **New investment** button.
- Empty state: "No investments yet" with a create button.
- A row opens the detail page.

### Detail — `/orgs/:orgId/bank/investments/:accountId`

- As the [regular account detail](regular.md#detail--orgsorgidbankaccountsaccountid): header,
  actions, archived banner, paginated ledger with inline add / edit.
- Plus an **investment info block**: kind, yield rate and period, maturity date, liquidity
  (D+N).
- **Add application** / **Add withdrawal** / **Update value** shortcuts above the ledger (see
  [Recording movements](#recording-movements)); hidden on an archived investment.

### Create / Edit — `/orgs/:orgId/bank/investments/new`, `/orgs/:orgId/bank/investments/:accountId/edit`

- Common fields, with "Bank" relabelled **Institution** and the opening date labelled
  **Start date**.
- **No opening-balance field** — the account always starts at 0.
- Optional investment fields: Kind, Yield rate (the yield period appears once a rate is
  entered), Maturity date, Liquidity (D+N), plus the common Notes.
- `type` is not shown — always `investment` from this submenu.

## Routes and permissions

Investments **reuse the generic account routes** of
[regular.md](regular.md#routes-and-permissions) — no `/investments.json` routes, so archive /
delete logic is not duplicated. Investment-specific data travels as a nested `investment`
object. All routes live under `/api/orgs/:orgId/bank`.

| Method | Route | Change for investments | Cache class |
|---|---|---|---|
| GET | `/accounts.json?type=investment&archived=false` | `type=investment` lists investments; each row carries its `investment` object | `user-scoped` |
| POST | `/accounts.json` | Now accepts `type: "investment"` with an optional `investment: {…}` object; `opening_balance` must be `0` | `never` |
| GET | `/accounts/:accountId.json` | Includes `investment` for an investment account | `user-scoped` |
| PATCH | `/accounts/:accountId.json` | Accepts `investment: {…}`, merged partially; `type` stays immutable; `opening_balance` must stay `0`; on an archived investment only `name` is accepted (as #29) | `never` |
| DELETE, archive, unarchive | unchanged | Same rules as [regular.md](regular.md#accounts) | `never` |
| Transactions, settings | unchanged | Generic routes of [transactions.md](transactions.md#routes) | as there |

The `investment` object (`snake_case`): `kind`, `yield_rate` (decimal string, e.g. `"12.5"`),
`yield_period`, `maturity_date`, `liquidity_days`. Unset fields are returned as `null`; on
PATCH, `null` clears an optional field.

### Validation

- An `investment` object on a non-investment account (create or PATCH) → 400.
- A non-zero `opening_balance` on an investment account (create or PATCH) → 400.
- `yield_rate` and `yield_period` go together: one without the other → 400.
- `liquidity_days` not an integer ≥ 0 → 400.
- `kind` not one of the enum values → 400.
- `yield_rate` outside 0–100 or with more than 4 decimals → 400.
- Unknown fields inside `investment` are rejected by the whitelist `ValidationPipe`.

### Permissions and caching

Same as [regular.md](regular.md#rules):

- **404, never 403** — misses (unknown, non-numeric, other-organization ids, non-member
  `:orgId`) are indistinguishable.
- **Permissions** — every member of the organization can do everything; roles are stored but
  not enforced.
- **Bodies** are whitelisted; never accepted: `organizationId`, `accountId`, `createdByUserId`,
  `type` on PATCH, computed fields.
- **Caching** — `GET` routes are `user-scoped` (declared with `@CachePolicy`, sent with
  `X-Skip-Cache`); writes are `never`. Nothing goes into Navi's warm-up.

## Data sensitivity & ownership

As [regular.md](regular.md#data-sensitivity--ownership): investment fields are financial data
but not credentials — no extra masking or encryption; request / response bodies are never
logged. Investments belong to the organization; every member can see and edit them until the
permission-system [Future epic](../README.md#future-epics).

## Owning module

- **`bank`** (lazy tier), as [regular.md](regular.md#owning-module) — **no new module**.
- **Table** — one new table, `bank_investment_details`: `account_id` is both PK and real FK to
  `bank_accounts.id` (`ON DELETE CASCADE`, same module), plus the investment fields. It carries
  no `organization_id` of its own — the organization comes from the account.
- **Other modules** — only `auth`, through the existing `@OrgScoped()` guard behind its DI
  token. No new cross-module access and no events.
- **Shape (implementation hint)** — an investment-details part inside `bank`, called by the
  generic account service when `type = investment`; no separate controller, since the routes
  are generic.

### Backward compatibility

Additive: a new table, a newly accepted `type` value and a nested `investment` object present
only on investment accounts. Regular and debt accounts are unchanged. The only behaviour change
is that `POST /accounts.json` with `type: investment` no longer answers 400 (the
[regular.md](regular.md#accounts) "until the other type specs exist" rule; reconciled by the
fold sub-issue of #26).

### Memory footprint

Negligible: one small table in the already-lazy `bank` module, no new dependency.

## Edge cases

1. **Name uniqueness across types** — the [#29 rule](regular.md#name-uniqueness) (unique within
   the organization, case-insensitive, among active accounts) applies across **all** account
   types: a regular "XP" and an investment "XP" clash (409).
2. **No `investment` object on POST** — an investment account always gets a
   `bank_investment_details` row (all fields null), so reads never handle a missing row.
3. **Delete** — the details row is removed with the account (`ON DELETE CASCADE` on the 1:1
   table); otherwise the [#29 rule](regular.md#archive-vs-delete) applies (409 when the account
   has transactions).
4. **Archived investment** — read-only as in #29 (only rename and unarchive); the
   **Add application** / **Add withdrawal** / **Update value** shortcuts are hidden.
5. **Wrong-type deep links** — the frontend redirects an investment opened under
   `/bank/accounts/:id` or `/bank/debts/:id` to `/bank/investments/:id`, and an account of
   another type opened under `/bank/investments/:id` to its own type's path.
   `GET /accounts/:id.json` returns any type.
6. **Past `maturityDate`** — allowed; it is just displayed.
7. **Yield rate 0** — valid; it still requires a period.
8. **No cross-field checks** — e.g. between `liquidityDays` and `maturityDate`.
9. **`opening_balance` on PATCH** — must stay `0`; a non-zero value → 400.
10. **Clearing the rate** — send `yield_rate` and `yield_period` both `null`.

## Resolved questions

- [x] Whether investment accounts appear in the main accounts list — **no**; they get their own
  **Investments** submenu (see [Investments submenu UI](#investments-submenu-ui)).
- [x] Fields specific to investment accounts — see [Fields](#fields).
- [x] Routes, permissions and cache class — see [Routes and permissions](#routes-and-permissions).

## Reference

- Epic: https://github.com/darthjee/ward/issues/26
- Skeleton sub-issue: https://github.com/darthjee/ward/issues/27
- Owning sub-issue: https://github.com/darthjee/ward/issues/31
- Common account fields, account routes and rules (#29): https://github.com/darthjee/ward/issues/29,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/regular.md
- Ledger, opening anchor, currency and transactions (#29): https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/transactions.md
- Details-table and nested-object pattern (#30): https://github.com/darthjee/ward/issues/30,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/banking/accounts/debt.md
- Organizations, `@OrgScoped()`, data-ownership rule: https://github.com/darthjee/ward/issues/28,
  https://github.com/darthjee/ward/blob/main/docs/agents/specs/auth/organizations.md
- Cache classes (`user-scoped`, `never`, `X-Skip-Cache`): https://github.com/darthjee/ward/blob/main/docs/agents/architecture/caching.md
- Spec lifecycle: https://github.com/darthjee/ward/blob/main/docs/agents/specs.md

## Required tests

**Backend**

- Create: `type: "investment"` accepted, with or without an `investment` object; without it a
  `bank_investment_details` row is still created (all fields null); common-field validation as
  in [regular.md](regular.md#required-tests).
- Validation → 400: an `investment` object on a non-investment account (create and PATCH);
  `yield_rate` without `yield_period` and vice versa; `liquidity_days` negative or not an
  integer; `kind` not a valid enum value; `yield_rate` negative, over 100 or with 5 decimals;
  unknown fields inside `investment`. Boundaries accepted: `yield_rate` 0 and 100, 4 decimals;
  `liquidity_days` 0; each `kind` value.
- A non-zero `opening_balance` on an investment account → 400 on create and on PATCH; `0` is
  accepted.
- The `investment` object is present (`snake_case`, rate as a decimal string, unset fields
  `null`) on list rows, the detail and the create / PATCH responses of investment accounts, and
  absent on other account types.
- PATCH merges `investment` partially (omitted fields unchanged); `null` clears a field; the
  rate is cleared with both `yield_rate` and `yield_period` `null`; `type` rejected.
- A negative balance is allowed, with no error.
- Archived investment: only `name` accepted on PATCH (any `investment` field → 409); transaction
  writes → 409 (as [transactions.md](transactions.md#required-tests)).
- Delete: an investment with no transactions is deleted together with its
  `bank_investment_details` row (`ON DELETE CASCADE`); with transactions → 409.
- Name uniqueness across types: an investment named like an active regular or debt account
  (case-insensitive) → 409 on create, rename and unarchive.
- List: `type=investment` returns investment accounts only, sorted by name, archived hidden
  unless `archived=true`; the default (`regular`) list excludes investments; no N+1 for
  balances or details.
- `GET /accounts/:id.json` returns an investment account with its `investment` object.
- Unknown, non-numeric and other-organization `:accountId`, and a non-member `:orgId`, → 404
  with identical bodies on every investment-related call.
- `GET` routes are `user-scoped` and send `X-Skip-Cache`; writes are `never`.
- Request / response bodies are not logged.

**Frontend**

- Investments list: columns name, institution, kind, current value, yield rate with period,
  maturity date, currency; amounts formatted with `Intl`; no total row; sorted by name;
  *Show archived* toggle; **New investment** button; empty state "No investments yet" with a
  create button; a row opens the investment detail.
- Investment detail: the investment info block; ledger as for regular accounts;
  **Add application** opens the inline form with a positive amount and "Application"
  prefilled; **Add withdrawal** takes a positive amount and posts it negative, with
  "Withdrawal" prefilled; **Update value** posts a "Yield" transaction for
  `currentValue − balance` (positive or negative), and for a difference of 0 posts nothing and
  shows "Value unchanged"; the plain inline add stays; all shortcuts hidden on an archived
  investment.
- Create / Edit: labels Institution and Start date; no opening-balance field (`opening_balance`
  sent as `0`); the yield period appears only once a rate is entered; optional Kind, Maturity
  date, Liquidity (D+N) and Notes; `type` is not shown.
- Wrong-type deep links: an investment opened under `/bank/accounts/:id` or `/bank/debts/:id`
  redirects to `/bank/investments/:id`, and another type opened under
  `/bank/investments/:id` redirects to its own path.
- Investments are absent from the **Accounts** list.
- The Bank menu shows the **Investments** entry, listing investment accounts only.
- Names, institution, notes and descriptions are rendered escaped.
