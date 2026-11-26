# Reconciliations client

Add `frontend/assets/js/client/ReconciliationsClient.js`, modelled on `TypedAccountsClient.js`
(a private module plus a default-exported object), and spread it into `BankClient`. Every method
takes `context` first and builds its path with `accountPath(context, accountId, suffix)`:

| Method | HTTP | Path suffix | Body |
|---|---|---|---|
| `listReconciliations(context, accountId, page = 1)` | GET | `/reconciliations` + `?page=N` | — |
| `startReconciliation(context, accountId, attrs)` | POST | `/reconciliations` | whitelist `STATEMENT_FIELDS` |
| `getReconciliation(context, accountId, id)` | GET | `/reconciliations/:id` | — |
| `updateReconciliation(context, accountId, id, attrs)` | PATCH | `/reconciliations/:id` | whitelist `STATEMENT_FIELDS` |
| `cancelReconciliation(context, accountId, id)` | DELETE | `/reconciliations/:id` | — |
| `tickTransactions(context, accountId, id, attrs)` | PATCH | `/reconciliations/:id/ticks` | whitelist `TICK_FIELDS` |
| `finishReconciliation(context, accountId, id)` | POST | `/reconciliations/:id/finish` | `{}` |
| `undoReconciliation(context, accountId, id)` | POST | `/reconciliations/:id/undo` | `{}` |

Export `STATEMENT_FIELDS = ['statement_date', 'statement_balance']` and
`TICK_FIELDS = ['tick', 'untick']`. Every path ends in `.json`. Use `ApiClient.getJson`,
`postJson`, `patchJson` and `deleteJson` as `BankClient` does.

Spec: `ReconciliationsClientSpec.js` loops over the `CONTEXTS` list (personal `''` and org
`/orgs/5`) with `fetchSequence`, following `BankClientSpec.js`. For each method it asserts the
URL, the HTTP method and the body. Unknown keys (`id`, `status`, `account_id`, `reconciled_at`)
must be stripped from start, edit and ticks. Add one "is exposed through BankClient" test per
method, as `TypedAccountsClientSpec.js` does.

## Files to Change
- `frontend/assets/js/client/ReconciliationsClient.js` — new client.
- `frontend/assets/js/client/BankClient.js` — spread `...ReconciliationsClient`.
- `frontend/specs/assets/js/client/ReconciliationsClientSpec.js` — new spec.
