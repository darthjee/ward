# BankClient

Add `client/BankClient.js`, a plain object like `OrganizationsClient`, and the first consumer of
`contextPath(context, apiPath)`. Every method takes the owner `context` first:

- `listAccounts(context, { archived })` → GET `/bank/accounts.json?type=regular&archived=<bool>`
- `getAccount(context, id)` → GET `/bank/accounts/:id.json`
- `createAccount(context, attrs)` → POST `/bank/accounts.json`
- `updateAccount(context, id, attrs)` → PATCH `/bank/accounts/:id.json`
- `deleteAccount(context, id)` → DELETE
- `archiveAccount` / `unarchiveAccount(context, id)` → POST `.../archive.json` / `.../unarchive.json`
- `listTransactions(context, accountId, page)` → GET `.../transactions.json?page=N`
- `createTransaction(context, accountId, attrs)` / `updateTransaction(context, accountId, id, attrs)` / `deleteTransaction(context, accountId, id)`
- `getSettings(context)` → GET `/bank/settings.json`

Bodies are built from an explicit whitelist of `snake_case` keys (`name`, `bank_name`, `branch`,
`account_number`, `currency`, `opening_date`, `opening_balance`, `notes`; `date`, `amount`,
`description`, `notes`) via `pickDefined`, so owner fields (`user_id`, `organization_id`) and
unknown keys can never be sent. `notes: null` is preserved (clears notes). Query strings are
built into the path (`getJson` has no params argument). An `undefined` result (session expired)
is passed through.

Specs: every method under both `/bank/...` and `/orgs/:orgId/bank/...`, method, body JSON, and
that owner / unknown fields passed in are dropped.

## Files to Change
- `frontend/assets/js/client/BankClient.js` — new
- `frontend/specs/assets/js/client/BankClientSpec.js` — new
