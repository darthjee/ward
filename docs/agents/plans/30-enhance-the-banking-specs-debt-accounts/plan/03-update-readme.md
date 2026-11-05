# Update the banking README index and Future epics

In `docs/agents/specs/banking/README.md`:

- **Index** — change the `accounts/debt.md` concern from "Debt accounts" to a summary such as
  "Debt accounts (loans): debt fields in `bank_debt_details`, ledger sign rules, payment /
  interest shortcuts, `debt` object on the generic account routes, Debts submenu pages".
- **Sub-issue map** — extend the #30 row to list what it now covers (`accounts/debt.md`
  contents, `ui/menu.md` (Debt row), this `README.md` (index entry and `## Future epics`)),
  in the style of the #29 row.
- **Future epics** — append item **11. Credit card accounts** (from
  `accounts/debt.md#credit-cards`): a separate account `type` (e.g. `credit_card`) for
  revolving accounts with statement cycles; same ledger mechanics as debts (purchases negative,
  payments positive, positive balances allowed) but starting at zero; the epic decides
  statement cycles, closing / due dates and how it relates to bills (#33). Mention it must
  respect the one-currency-per-account rule.
- Optionally, in **Decisions**, replace "the exact split is decided later" for the Bank menu
  with "debts get their own **Debts** submenu; provider-expense placement is decided by #32"
  — only if it keeps the README consistent with `ui/menu.md`.

## Files to Change
- `docs/agents/specs/banking/README.md` — index entry, sub-issue map row, new Future epic,
  and (optionally) the Bank-menu decision bullet.
