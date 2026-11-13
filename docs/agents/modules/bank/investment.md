# Bank — Investment accounts

An investment account is an `Account` with `type` `investment`: **one account = one
investment** (a specific CDB, fund…). A broker holding several assets is several investment
accounts. It reuses [accounts.md](accounts.md) and [transactions.md](transactions.md), and adds
only what is specific to investments. Part of the [Bank module](../bank.md).

Endpoints: [Routes — Bank → Investment object](../../backend/routes/bank.md#investment-object).

## Ledger as the current value

- An investment is a plain ledger: its **balance is the investment's current value**.
- The **opening anchor is forced to 0**: `opening_balance` must be `0` on create and PATCH
  (otherwise 400). Only `openingDate`, the start date, matters.
- The initial amount invested is the first **Application** transaction, so every money-in shows
  in the ledger.
- **Applications** are positive, **withdrawals** negative. **Yield** is entered by hand as a
  transaction described "Yield", positive for gains, negative for losses.
- Taxes and fees get no special support: negative transactions, folded into the yield or with a
  free description ("IR", "Fee").
- A negative balance is allowed, with no warning.

## Movements

Investments use the generic transaction routes; there is no `kind` column. The detail page's
shortcuts only pre-fill the inline form (see [ui.md](ui.md#investments)):

- **Add application** — positive amount, "Application".
- **Add withdrawal** — typed positive, posted negative, "Withdrawal".
- **Update value** — the user types the broker's current value; the UI posts a "Yield"
  transaction for `currentValue − balance` (positive or negative). A difference of 0 posts
  nothing and shows "Value unchanged". No new route.

Moving money from a regular account into an investment (or back) is two manual transactions;
linking them is the *Linked transfers* epic ([#86](https://github.com/darthjee/ward/issues/86)).

## Fields

The common fields apply. `bankName` is reused as the **institution / broker**. There are no
structured yield-index fields: "110% CDI" or "IPCA + 5%" go in `notes`.

Investment fields, all optional and **informational only** (never used in a computation), in
`bank_investment_details` (1:1, `account_id` PK and FK, `ON DELETE CASCADE`, no owner columns):

| Field | Type | Notes |
|---|---|---|
| `kind` | `fixed_income` \| `fund` \| `stocks` \| `savings` \| `pension` \| `crypto` \| `other` | Kind of product |
| `yieldRate` | decimal, 0–100, at most 4 decimals | Returned without trailing zeros (`"12.5"`) |
| `yieldPeriod` | `monthly` \| `yearly` | Required with `yieldRate`, and only then |
| `maturityDate` | date | Any real `YYYY-MM-DD` date, past or future (the ledger's "today + 1" limit does not apply) |
| `liquidityDays` | int 0–2147483647 | D+N redemption delay; `0` = daily liquidity |

### Rules

- An investment always has a details row (every field `null` when created without an
  `investment` object).
- PATCH merges partially; `null` clears. The `yield_rate` ↔ `yield_period` pair is checked on
  the stored details with the request merged on top
  ([#52](https://github.com/darthjee/ward/issues/52)); the rate is cleared by sending both
  `null`.
- On an archived investment, any `investment` field → 409 `ACCOUNT_ARCHIVED` (format errors are
  still 400 first).
- No cross-field checks (for example between liquidity and maturity). A yield rate of 0 is
  valid and still needs a period.

## Alternatives considered

- **A separate, overwritable `currentValue` field** — rejected: two sources of truth and no
  history of how the value changed.
- **A valuation-history table** (periodic snapshots) — rejected for now: it needs a new table
  and routes. Value snapshots and performance charts are the *Investment valuation history*
  epic ([#92](https://github.com/darthjee/ward/issues/92)); the ledger balance stays the single
  source of truth for the current value.
- **Per-asset tracking** (tickers, quantities, prices) — out of scope; one account is one
  investment.

## Deferred

- Investment valuation history: [#92](https://github.com/darthjee/ward/issues/92)
- Linked transfers: [#86](https://github.com/darthjee/ward/issues/86)
- Currency conversion: [#88](https://github.com/darthjee/ward/issues/88)

## Differences from the original spec

None beyond the details decided during implementation (#52), recorded above: the merged-state
paired rule, the `maturity_date` and `liquidity_days` ranges and the rate formatting.
