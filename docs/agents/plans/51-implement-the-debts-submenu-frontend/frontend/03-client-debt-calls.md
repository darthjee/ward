# Client calls for debt accounts

Extend `client/BankClient.js`:

- **List**: let `listAccounts(context, { archived, type = 'regular' })` take the type (or add
  `listDebts(context, { archived })` delegating to it) so Debts calls
  `<base>/accounts.json?type=debt&archived=…`. Accounts keeps `type=regular`.
- **Create**: a debt create path (e.g. `createDebt(context, attrs)` or a `type` option on
  `createAccount`) that sends `type: "debt"` plus a nested `debt` object whitelisted to
  `DEBT_FIELDS` = `interest_rate`, `interest_period`, `instalment_amount`,
  `instalment_frequency`, `due_day`, `due_month`, `instalment_count`, keeping `null` (clearing)
  and dropping `undefined`.
- **Update**: `updateDebt(context, id, attrs)` (or an option on `updateAccount`) sends the
  whitelisted common fields plus the whitelisted nested `debt`; never `type` on PATCH.
- Generic `createAccount` / `updateAccount` keep stripping `type` and `debt` as today —
  `BankClientSpec`'s `FORBIDDEN` assertions must still hold for them; nested unknown keys in
  `debt` are stripped too.

Specs in `BankClientSpec.js`, in both contexts (`CONTEXTS.forEach`): list path with
`type=debt`; create body with `type: "debt"` and whitelisted `debt`; PATCH body with `debt`
and without `type`; `null` preserved for `interest_rate` / `interest_period`; unknown nested
keys dropped.

## Files to Change
- `client/BankClient.js` — type option on list, debt create / update with `DEBT_FIELDS` whitelist
- `frontend/specs/assets/js/client/BankClientSpec.js` — new cases, both contexts
