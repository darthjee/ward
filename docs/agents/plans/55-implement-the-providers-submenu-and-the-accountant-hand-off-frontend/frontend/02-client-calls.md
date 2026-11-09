# Add provider and accountant client calls

`client/BankClient.js` is at 295 lines, so it has to be split before calls are added.

1. Collapse the typed create / update helpers into one generic pair, e.g.
   `createTyped(context, type, key, fields, attrs)` and `updateTyped(context, id, key, fields,
   attrs)`, built on `nestedBody`. Keep the public names `createDebt`, `updateDebt`,
   `createInvestment` and `updateInvestment` working.
2. Add `PROVIDER_EXPENSE_FIELDS = ['for_accountant','provider_tax_id','expected_amount',
   'charge_frequency','due_day','due_month']`, plus these calls:
   - `createProviderExpense(context, attrs)` posts `{ type: 'provider_expense', ...common,
     provider_expense }`.
   - `updateProviderExpense(context, id, attrs)` sends a PATCH with no `type`, keeping
     `null`s.
   Listing reuses `listAccounts(context, { archived, type: 'provider_expense' })`.
3. Add a new `client/AccountantClient.js`:
   - `listCharges(context, { from, to, includeSent })` →
     `GET contextPath(context, '/bank/accountant/charges.json?' + URLSearchParams({ from, to,
     include_sent }))`;
   - `markSent(context, ids)` → `POST …/accountant/mark-sent.json` with `{ transaction_ids:
     ids }`;
   - `markUnsent(context, ids)` → `POST …/accountant/mark-unsent.json`, same body.
   If splitting the account calls is cleaner, move them into their own module instead.
4. Specs:
   - `BankClientProvidersSpec.js` covers both contexts (`''` and `/orgs/5`), the whitelist,
     no `type` on PATCH, `null` passthrough and forbidden keys.
   - `AccountantClientSpec.js` covers paths and query params for both contexts and the body
     shape (only `transaction_ids`).
   - Existing `BankClientSpec` / `BankClientInvestmentsSpec` must keep passing.

## Files to Change
- `frontend/assets/js/client/BankClient.js` — generic typed create / update; provider calls; stay under 300 lines
- `frontend/assets/js/client/AccountantClient.js` (new) — preview, mark-sent, mark-unsent
- `frontend/specs/assets/js/client/BankClientProvidersSpec.js` (new)
- `frontend/specs/assets/js/client/AccountantClientSpec.js` (new)
