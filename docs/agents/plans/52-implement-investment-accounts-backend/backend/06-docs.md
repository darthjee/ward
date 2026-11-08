# Documentation
Record the implementation and the issue decisions (owned by the `architect`; mirrors the #50
doc edits).

- `docs/agents/specs/banking/accounts/investment.md`: add the issue decisions (merged paired
  rule on PATCH with examples, `maturity_date` any real calendar date, `liquidity_days`
  0..2147483647, `yield_rate` without trailing zeros, archived → 409 with format errors still
  400), in the style of `debt.md`'s decisions section.
- `docs/agents/backend/routes/bank.md`: `type=investment` in the list query and `type` row
  ("`regular`, `debt` and `investment` have handlers"); new "Investment object" section like
  "Debt object"; the opening-balance-must-be-0 rule and its 400; validation errors.
- `docs/agents/backend/routes.md`: account types list.
- `docs/agents/architecture/backend.md`: table-ownership row for `bank_investment_details`;
  mention the `validateAccount` handler hook if the handler contract is described there.
- `docs/agents/specs/banking/accounts/regular.md` and `debt.md`: lists of types that have a
  handler.

## Files to Change
- `docs/agents/specs/banking/accounts/investment.md` — issue decisions
- `docs/agents/backend/routes/bank.md` — investment type, object, rules, errors
- `docs/agents/backend/routes.md` — types list
- `docs/agents/architecture/backend.md` — table ownership, handler hook
- `docs/agents/specs/banking/accounts/regular.md` — handler types list
- `docs/agents/specs/banking/accounts/debt.md` — handler types list
