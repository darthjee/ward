# Account detail page and ledger

`BankAccountDetail.jsx` (`bank-account`) at `<ui>/bank/accounts/:accountId[?page=N]`.

**Header**: name, bank / branch / full account number, currency, balance (`formatMoney`),
opening date, notes, Archived badge. Actions: **Edit** link; **Archive** / **Unarchive**;
**Delete** only when ledger `total_count === 0` (confirmed with `ConfirmModal`). Every action
button disabled while its request is in flight. Archive / unarchive / delete never display the
masked write response: reload the account (delete → navigate to the list).

**Ledger** (loaded with the account; `pageFromHash` for the page):
- Columns: date, description (+ read-only notes beneath when present), amount, running balance
  (`balance`), newest first as returned.
- `opening` rendered as a final muted "Opening balance" row only when present (last page), no
  actions.
- `BankPagination` with `hrefFor(page)` = `contextHash(context, '/bank/accounts/:id') +
  '?page=N'`; hidden when `total_pages` is 1. Page change goes through the hash, so
  reload / back / forward keep it.
- Page past the end (`transactions: []`, `opening: null`, page > 1) → "No transactions on this
  page" with a link to page 1.

**Inline form row** at the top (`LedgerFormController` + `LedgerFormHelper.jsx`):
- Fields: date (`max` local today, default local today), Out / In toggle (default Out), amount,
  description, Notes toggle revealing notes.
- Client checks: description required; date not after local today; `parseAmount(amount,
  { currency, allowNegative: false, allowZero: false })`; body amount via `toSignedAmount`.
- **Edit** on a row loads it into the form (title "Editing …", Save / Cancel), highlights the
  row, sets the toggle from `fromSignedAmount`, opens Notes when present; one form at a time.
  When editing, clearing notes sends `notes: null`.
- **Delete** on a row → `ConfirmModal`, then DELETE.
- After **create** → navigate to page 1 (or reload if already on page 1); after **edit** /
  **delete** → reload the current page (and the account, for the balance and `total_count`).
- **Unsaved changes**: switching to another row's Edit or changing the page while the form is
  dirty asks `window.confirm` (injected for specs) before discarding.
- Field errors (client or 400 details/message) shown on the row, values kept.
- **Archived account**: form row and every row's Edit / Delete hidden; ledger stays readable
  and paginated.

**Errors** (`classifyError`): 404 → `NotFound` (also stale org ids); 409 → message in an inline
alert, then reload account + ledger (`ACCOUNT_ARCHIVED` hides writes, `ACCOUNT_HAS_TRANSACTIONS`
hides Delete, message points to Archive); network / 5xx → dismissible alert with Retry.

Keep the page thin: split controllers (`BankAccountDetailController` for archive / unarchive /
delete, `LedgerFormController`, `LedgerLoader`) and helpers (`BankAccountHeaderHelper`,
`LedgerTableHelper`, `LedgerFormHelper`) to stay under the lint limits. Register `bank-account`
in `AppHelper`.

Specs: every *Frontend* item of `transactions.md` and the detail items of `regular.md`; Delete
shown from `total_count`; 409 reload flows; 404; 400 details; Retry; double submit;
unsaved-form confirmation; create → page 1, edit / delete → reload current page; past-the-end
message; opening row only on the last page and without actions; archived read-only; both
contexts.

## Files to Change
- `frontend/assets/js/components/resources/bank/accounts/pages/BankAccountDetail.jsx` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/controllers/BankAccountDetailController.js` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/controllers/LedgerLoader.js` — new (or extend `BankAccountLoader`)
- `frontend/assets/js/components/resources/bank/accounts/pages/controllers/LedgerFormController.js` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/helpers/BankAccountHeaderHelper.jsx` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/helpers/LedgerTableHelper.jsx` — new
- `frontend/assets/js/components/resources/bank/accounts/pages/helpers/LedgerFormHelper.jsx` — new
- `frontend/assets/js/components/helpers/AppHelper.jsx` — register `bank-account`
- `frontend/specs/assets/js/components/resources/bank/accounts/pages/` — page, controller, loader and helper specs mirroring the above
