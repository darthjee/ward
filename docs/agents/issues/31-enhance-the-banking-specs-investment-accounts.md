# Issue: Enhance the banking specs: investment accounts

## Description

Part of Epic #26 (Bank module). Ward's first domain module, `bank` (lazy tier), tracks bank accounts, business expenses for the accountant and bills to pay, scoped to **organizations**. The feature follows the spec lifecycle in `docs/agents/specs.md`: specs are written under `docs/agents/specs/banking/` first, refined by enhancement sub-issues, then implemented, folded into the permanent docs and removed.

This sub-issue **refines the specs** for **investment accounts**: it turns the stub `docs/agents/specs/banking/accounts/investment.md` (written by #27) into an agreed definition. It is documentation-only — no code. It depends on the initial-specs sub-issue and can run in parallel with the other spec-enhancement sub-issues.

## Problem

`accounts/investment.md` only records that an investment account is an `Account` with `type` `investment` belonging to an organization. Its open questions — whether investment accounts appear in the main accounts list, which fields are specific to them, and their routes, permissions and cache class — block implementation.

## Expected Behavior

- `docs/agents/specs/banking/accounts/investment.md` is rewritten with every decision below, its open questions closed, and it keeps the **Reference** and **Required tests** sections required by `docs/agents/specs.md`.
- `docs/agents/specs/banking/ui/menu.md` gains an **Investments** row owned by #31, replacing the "Where investment accounts are shown depends on…" paragraph.
- The `docs/agents/specs/banking/README.md` index entry (and the #31 row of the sub-issue map) reflect the updated file.

## Solution

### Investment model

- An investment account is a **plain ledger**, the same shape as regular and debt accounts: its
  balance (opening anchor + transactions) **is** the investment's current value.
- **Applications** (money in) are positive transactions; **withdrawals** (money out) are negative
  transactions.
- **Yield** is recorded manually as a transaction described "Yield": positive for gains, negative
  for losses — mirroring manual interest on debt accounts. No automation.
- Rejected alternatives: a separate overwritable `currentValue` field (two sources of truth, no
  history) and a valuation-history table (new table/routes; candidate Future epic).
- **Opening anchor**: an investment starts at **0** — `openingBalance` must be 0 (a non-zero
  value is a 400; only `openingDate` matters) and the initial amount invested is recorded as the first
  Application transaction, so every money-in shows in the ledger.
- **"Update value" shortcut** (UI only): the user types the broker's current value; the UI
  computes `currentValue − balance` and creates a Yield transaction for the difference (positive
  or negative). No new route — it posts a regular transaction.
- **Granularity**: one investment account = **one investment** (e.g. a specific CDB or fund). A
  broker holding several assets is modelled as several investment accounts. Per-asset tracking
  (tickers, quantities, prices) is out of scope.
- A negative balance is allowed, with no warning (same as other account types).

### Type-specific fields

- `bankName` is reused as the **institution/broker** (label "Institution" in the UI).
- Optional, informational-only fields (never used in any computation) live in a 1:1 table
  `bank_investment_details`, keyed by `account_id` (same pattern as `bank_debt_details`):
  - `kind` — enum `fixed_income` / `fund` / `stocks` / `savings` / `pension` / `crypto` / `other`;
  - `yieldRate` (decimal 0–100, up to 4 decimals) + `yieldPeriod` (`monthly` / `yearly`,
    required together) — for fixed-rate products;
  - `maturityDate` (date);
  - `liquidityDays` (integer ≥ 0; D+N redemption, 0 = daily liquidity).
- **No structured index fields** (CDI, IPCA, …): indexed or otherwise complex yields
  ("110% CDI", "IPCA + 5%") go in the account's existing free-text `notes`, so users can write
  whatever describes their product.

### Recording movements

- Movements use the **generic `Transaction`** entity and routes — no `kind` column; the
  movement type is conveyed by sign and description only.
- UI shortcuts on the investment detail page (each pre-fills the transaction form):
  - **Add application** — positive amount, description "Application";
  - **Add withdrawal** — amount typed **positive**, stored **negative**, description
    "Withdrawal";
  - **Update value** — the user types the current value; the UI creates a Yield transaction for
    `currentValue − balance`. If the difference is 0, no transaction is created and the UI shows
    "Value unchanged".
- Moving money from a regular account into an investment (or back) is **two manual
  transactions**, one on each account. Linked transfers are out of scope (same as debt).
- Taxes and fees get no special support: the user records them as negative transactions (folded
  into the yield or with a free description such as "IR" or "Fee").

### UI placement

- Investment accounts get their **own "Investments" submenu** under
  `/orgs/:orgId/bank/investments`: list, detail (ledger + Add application / Add withdrawal /
  Update value shortcuts) and new / edit pages — same pattern as Debts. They do **not** appear in
  the main Accounts list (which stays `regular` only, per #29).
- **List columns**: name, institution, kind, current value (balance), yield rate / period,
  maturity date, currency. No total row (currencies may differ; same as Debts).
- **Form**: Institution (`bankName`), Start date (`openingDate`), **no opening-balance field**
  (the account starts at 0); optional Kind, Yield rate + period, Maturity date, Liquidity (D+N)
  and Notes.
- `ui/menu.md`: this issue adds an **Investments** row (owned by #31) and removes the "Where
  investment accounts are shown depends on…" paragraph.

### Routes, permissions and caching

- **Routes**: reuse the generic account routes with `type=investment`
  (`GET`/`POST /api/orgs/:orgId/bank/accounts.json`, `GET`/`PATCH`/`DELETE
  …/accounts/:id.json`), with a nested snake_case **`investment`** object (`kind`,
  `yield_rate`, `yield_period`, `maturity_date`, `liquidity_days`). `PATCH` merges it partially;
  `null` clears an optional field; an archived investment accepts only a `name` change.
- **Validation** (400):
  - an `investment` object on a non-investment account;
  - `yield_rate` without `yield_period` or vice versa;
  - `liquidity_days` not an integer ≥ 0; `kind` not a valid enum value;
  - a non-zero `opening_balance` on an investment account.
- **Transactions**: the generic transaction routes; no investment-specific route.
- **Permissions**: same as #29.
- **Caching**: `GET` routes `user-scoped`, writes `never`; not warmed by Navi (same as #29 /
  #30).

### Edge cases

- Account names are unique across **all** account types.
- An investment always has a `bank_investment_details` row; deleting the account cascades it.
- An archived investment is read-only; the Add application / Add withdrawal / Update value
  shortcuts are hidden.
- The frontend redirects deep links to an account of the wrong type.
- A `maturityDate` in the past is allowed (just displayed).
- A `yieldRate` of 0 is valid.
- No cross-field checks (e.g. `liquidityDays` vs `maturityDate`).
- `opening_balance` must stay 0 on `PATCH` too (non-zero → 400).

### Scope

- **In**: rewrite `docs/agents/specs/banking/accounts/investment.md` with the decisions above
  (closing its open questions, keeping **Reference** and **Required tests**), add the
  **Investments** row to `ui/menu.md`, update the `README.md` index entry and the #31 sub-issue map row, and add a
  **"Investment valuation history"** Future epic (value snapshots, performance charts) to the
  README.
- **Out**: per-asset tracking (tickers, quantities, prices), valuation history / performance
  charts (recorded as a Future epic), automated yield, structured yield indexes, tax / fee handling,
  linked transfers between accounts, currency conversion.

## Benefits

- Investment accounts get an implementable definition that reuses the existing ledger, details-table and generic-route patterns from #29 and #30 — no new concepts, minimal new code.
- Users can track each investment's current value and its full history of applications, withdrawals and yield from one place.
