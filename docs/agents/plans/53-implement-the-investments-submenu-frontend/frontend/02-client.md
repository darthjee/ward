# Client calls for investments

Add the investment calls to `BankClient`, without passing the 300-line file limit.

- Generalise the private `debtBody(attrs)` into `nestedBody(attrs, key, fields)`. It keeps
  the whitelisted common fields, plus `[key]: whitelist(attrs[key], fields)` when `attrs[key]`
  is not null/undefined. It never adds `type`.
- Add `INVESTMENT_FIELDS = ['kind', 'yield_rate', 'yield_period', 'maturity_date', 'liquidity_days']`.
- `createInvestment(context, attrs)` POSTs `{type: 'investment', ...nestedBody(attrs, 'investment', INVESTMENT_FIELDS)}`.
  `opening_balance` comes from the attrs (`"0"` from the form).
- `updateInvestment(context, id, attrs)` PATCHes `nestedBody(attrs, 'investment', INVESTMENT_FIELDS)`.
  `null` values are kept, so clearing works.
- Listing reuses `listAccounts(context, {archived, type: 'investment'})`. Add
  `listInvestments` only if it mirrors `listDebts` for symmetry.
- `createAccount` / `updateAccount` must keep stripping `type`, `debt` **and** `investment`.

Specs (`BankClientSpec.js`, both contexts):
- The URL, method and body of each new call.
- `type: 'investment'` is set on create and never on update.
- The `FORBIDDEN` keys are stripped.
- Unknown keys inside `investment` are dropped, and `null`s are kept.
- `createAccount` / `updateAccount` strip `investment`.

If the spec would pass 300 lines, split it, e.g. into `BankClientInvestmentsSpec.js`.

## Files to Change
- `assets/js/client/BankClient.js` — `nestedBody`, `INVESTMENT_FIELDS`, `createInvestment`, `updateInvestment`
- `specs/assets/js/client/BankClientSpec.js` (and possibly a new split spec) — coverage for the above
