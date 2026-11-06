# Rewrite accounts/investment.md

Replace the #27 skeleton in `docs/agents/specs/banking/accounts/investment.md` with the full
definition. Use `accounts/debt.md` as the structural and stylistic template. Every decision
comes from the issue's Solution section. Do not invent new rules.

Content, by section:

- **Header note**: owned by #31. It builds on #29 (common fields, name uniqueness, archive vs
  delete, account routes in `regular.md`; ledger, opening anchor, currency, transaction routes in
  `transactions.md`) and follows the #30 details-table pattern. The file adds only what is
  specific to investments.
- **Summary**: an `Account` with `type` `investment`. One account is one investment (a specific
  CDB or fund). It belongs to an organization. It is **not** in the main Accounts list (which
  stays `regular` only) and gets its own **Investments** submenu. It is a plain ledger, and its
  balance **is** the current value.
- **Scope**: In and Out lists from the issue. Out covers per-asset tracking (tickers,
  quantities, prices), valuation history / performance charts (pointing to the new
  *Investment valuation history* Future epic), automated yield, structured yield indexes,
  tax / fee handling, linked transfers (existing Future epic), and currency conversion (existing
  Future epic).
- **Ledger and balance**: the opening anchor is forced to **0**. A non-zero `openingBalance` is
  a 400 on create and on PATCH, and only `openingDate` matters. The initial amount invested is
  the first Application. Applications are positive and withdrawals negative. Yield is a manual
  transaction described "Yield", positive for gains and negative for losses. A negative balance
  is allowed with no warning. Record the rejected alternatives (an overwritable `currentValue`
  field; a valuation-history table, now a Future epic), either here or in an "Alternatives
  considered" section like regular.md's.
- **Fields**: the common fields apply. `bankName` is reused as Institution / broker. The 1:1
  table `bank_investment_details` holds `kind` (enum `fixed_income` / `fund` / `stocks` /
  `savings` / `pension` / `crypto` / `other`), `yieldRate` (decimal 0–100, up to 4 decimals) and
  `yieldPeriod` (`monthly` / `yearly`), which must be set together, `maturityDate` (date) and
  `liquidityDays` (integer ≥ 0, D+N, 0 = daily). These fields are informational only. There are
  no structured index fields: things like "110% CDI" go in `notes`. Use a table like debt.md's
  Fields table (field, required, editable, notes).
- **Recording movements**: the generic `Transaction`, with no `kind` column. Describe the three
  UI shortcuts: Add application (positive, "Application"); Add withdrawal (typed positive,
  stored negative, "Withdrawal"); Update value (creates a "Yield" transaction for
  `currentValue − balance`; a difference of 0 creates nothing and shows "Value unchanged"). No
  new route. Moving money from or to a regular account is two manual transactions. Taxes and
  fees are negative transactions with a free description ("IR", "Fee").
- **Investments submenu UI** (anchor `#investments-submenu-ui`, used by `ui/menu.md`):
  - list at `/orgs/:orgId/bank/investments`: columns name, institution, kind, current value
    (balance), yield rate / period, maturity date, currency; no total row;
  - detail at `/orgs/:orgId/bank/investments/:accountId`: ledger plus the three shortcuts;
  - new / edit pages: Institution, Start date, no opening-balance field; optional Kind, Yield
    rate + period, Maturity date, Liquidity (D+N), Notes. `type` is not shown.
- **Routes and permissions**: the same route table shape as debt.md, with `type=investment` and
  a nested snake_case `investment` object (`kind`, `yield_rate` as a decimal string,
  `yield_period`, `maturity_date`, `liquidity_days`). Unset fields are `null`. PATCH merges
  partially, and `null` clears a field. An archived investment accepts only `name`.
  - **Validation** (400): an `investment` object on a non-investment account (create and
    PATCH); `yield_rate` without `yield_period` or the reverse; `liquidity_days` not an
    integer ≥ 0; an invalid `kind`; `yield_rate` out of 0–100 or with more than 4 decimals; a
    non-zero `opening_balance` (create and PATCH); unknown fields inside `investment`
    (whitelist).
  - **Permissions and caching**: same as #29: 404 never 403, all members can do everything,
    whitelisted bodies. `GET` routes are `user-scoped` with `@CachePolicy` and `X-Skip-Cache`;
    writes are `never`. Not warmed by Navi.
- **Data sensitivity & ownership**: same as debt.md.
- **Owning module**: `bank`, no new module. New table `bank_investment_details` whose
  `account_id` is both PK and FK to `bank_accounts.id`, `ON DELETE CASCADE`, with no
  `organization_id`. An investment-details part inside `bank`, called by the generic account
  service when `type = investment`. Backward compatibility (additive; `type: investment` stops
  answering 400) and Memory footprint (negligible), as in debt.md.
- **Edge cases** (numbered, as debt.md):
  1. Name uniqueness across all account types (409).
  2. A details row always exists, even with no `investment` object on POST (all fields null).
  3. Delete cascades the details row; the #29 409-with-transactions rule still applies.
  4. An archived investment is read-only, and the shortcuts are hidden.
  5. Wrong-type deep links redirect between `/bank/investments/:id` and the other types'
     paths.
  6. A past `maturityDate` is allowed.
  7. A `yieldRate` of 0 is valid but still requires a period.
  8. No cross-field checks.
  9. `opening_balance` must stay 0 on PATCH.
  10. Clearing the rate means sending `yield_rate` and `yield_period` both `null`.
- **Resolved questions**: check off the three original open questions, each linking to the
  section that answers it. Remove the `## Open questions` section.
- **Reference**: Epic #26, skeleton #27, owning #31, #29 issue plus `regular.md` and
  `transactions.md` blob URLs, #30 plus the `debt.md` blob URL (details-table pattern), #28
  plus `organizations.md`, `architecture/caching.md`, `specs.md`. GitHub URLs only.
- **Required tests**: split into **Backend** and **Frontend**, as debt.md does.
  - Backend:
    - create with and without an `investment` object (a details row always exists);
    - every 400 case above, plus the accepted boundaries (`yield_rate` 0 / 100 / 4 decimals,
      `liquidity_days` 0, each `kind` value);
    - non-zero `opening_balance` rejected on create and on PATCH;
    - the `investment` object shape, with nulls when unset;
    - PATCH partial merge and `null` clearing;
    - an archived investment accepts only `name`;
    - `type=investment` list filtering, and investments absent from `type=regular`;
    - name clash across types (409);
    - cascade delete;
    - 404 for other organizations;
    - cache headers.
  - Frontend:
    - the Investments list columns, with no total row;
    - the form has no opening-balance field and pairs yield rate with period;
    - Add application posts a positive amount; Add withdrawal stores a negative amount from
      positive input;
    - Update value posts a Yield for the difference, positive or negative, and shows "Value
      unchanged" for 0 without posting;
    - shortcuts are hidden when archived;
    - wrong-type redirects;
    - investments are absent from the Accounts list.

## Files to Change

- `docs/agents/specs/banking/accounts/investment.md`: full rewrite as described above.
