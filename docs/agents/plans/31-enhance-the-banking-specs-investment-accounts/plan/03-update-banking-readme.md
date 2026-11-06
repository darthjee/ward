# Update the banking README

Bring `docs/agents/specs/banking/README.md` in line with the new investment spec.

- **Decisions**:
  - In "The main accounts list shows `regular` accounts only" bullet, add investment accounts
    to the types seen in their own place.
  - In "The Bank menu" bullet, add **Investments** (investment accounts, their own submenu).
- **Index**: replace the `accounts/investment.md` concern text "Investment accounts" with a
  summary in the style of the debt row, for example: "Investment accounts (one per
  investment): plain ledger whose balance is the current value, opening anchor fixed at 0,
  application / withdrawal / yield movements and the Update value shortcut, informational
  fields in `bank_investment_details`, `investment` object on the generic account routes,
  Investments submenu pages".
- **Sub-issue map**: replace the #31 row's files cell with: "[accounts/investment.md](accounts/investment.md)
  — the investment model (ledger as current value, opening anchor 0, yield as transactions),
  investment fields (`bank_investment_details`), recording movements, `investment` object on the
  generic account routes, Investments submenu; `ui/menu.md` (Investments row); this `README.md`
  (index entry and `## Future epics`)".
- **Future epics**: append item 12, **Investment valuation history** (from
  [accounts/investment.md](accounts/investment.md#scope), or whichever section holds the
  deferral). It covers value snapshots over time and performance charts / returns. It must
  respect that the ledger balance stays the single source of truth for the current value (no
  overwritable `currentValue` field), that one account is one investment, and the
  one-currency-per-account rule. Mention that per-asset tracking (tickers, quantities, prices)
  stays out of scope unless the epic chooses to include it.

## Files to Change

- `docs/agents/specs/banking/README.md`: Decisions bullets, the index entry, the #31 sub-issue
  map row, and the new Future epic 12.
