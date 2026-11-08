# Wrong-type deep-link redirects

Edge case 7: `GET /accounts/:id.json` returns any type, so the frontend redirects:

- a debt opened under `<ui>/accounts/:id` → `<ui>/debts/:id`;
- a regular account opened under `<ui>/debts/:id` → `<ui>/accounts/:id`.

Implement once in the shared loader / `useAccountLedger` (step 01): accept an `expectedType`
and a map of type → section base; when the loaded `account.type` differs, `navigate(contextHash(
context, '<other base>/' + id))` and skip `setData`. Use the same check on the Edit pages'
load (`<ui>/accounts/:id/edit` ↔ `<ui>/debts/:id/edit`) for consistency. Types without a
frontend section (e.g. future `investment`) fall through to the existing not-found handling.

Specs, in both contexts: Accounts detail with a debt → redirected to the debts detail; Debts
detail with a regular account → redirected to the accounts detail; matching types render
normally (existing Accounts specs keep passing).

## Files to Change
- `components/resources/bank/common/…/useAccountLedger.js` and/or `BankAccountLoader.js` — `expectedType` + redirect
- `components/resources/bank/accounts/pages/BankAccountDetail.jsx`, `BankAccountEdit.jsx` — pass `expectedType: 'regular'`
- `components/resources/bank/debts/pages/BankDebtDetail.jsx`, `BankDebtEdit.jsx` — pass `expectedType: 'debt'`
- Specs for the loader/hook and both detail pages
