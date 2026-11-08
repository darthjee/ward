# Accounts list page

`components/resources/bank/accounts/pages/BankAccountList.jsx` (page key `bank-accounts`),
structured like the organization pages: page → controller / loader → helper.

- Reads the context with `useOwnerContext()` and `?archived=true` from the hash (`hashQuery`).
- Loader `BankAccountsLoader` + `buildBankAccountsLoadEffect(loader, context, archived, callbacks)`
  calls `BankClient.listAccounts(context, { archived })`; ignores `undefined` (session expired)
  and late answers (`isActive`).
- Helper renders a table: name, bank / branch / masked account number, balance via `formatMoney`
  in the account's currency (no grand total), an "Archived" badge when `archived_at` is set.
  Each row links to `contextHash(context, '/bank/accounts/:id')`. A **Show archived** toggle is a
  link switching `?archived=true` / none; a **New account** link to `/bank/accounts/new`. Empty
  state message.
- Errors: 404 (non-member org) → `<NotFound orgId={...} />`; network / 5xx → `BankErrorAlert`
  with Retry re-running the load.
- Register `['bank-accounts', <BankAccountList />]` in `AppHelper`'s `PAGES`.

Specs: `regular.md` *Frontend* list items (regular only, archived filter, balances in account
currency), both contexts, 404 → NotFound, Retry.

## Files to Change
- `frontend/assets/js/components/resources/bank/accounts/pages/BankAccountList.jsx` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/controllers/BankAccountsLoader.js` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/helpers/BankAccountListHelper.jsx` — new
- `frontend/assets/js/components/helpers/AppHelper.jsx` — register `bank-accounts`
- `frontend/specs/assets/js/components/resources/bank/accounts/pages/BankAccountListSpec.js` — new
- `frontend/specs/assets/js/components/resources/bank/accounts/pages/controllers/BankAccountsLoaderSpec.js` — new
- `frontend/specs/assets/js/components/resources/bank/accounts/pages/helpers/BankAccountListHelperSpec.js` — new
