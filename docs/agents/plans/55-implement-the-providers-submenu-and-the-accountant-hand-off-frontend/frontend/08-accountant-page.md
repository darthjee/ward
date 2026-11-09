# Accountant hand-off page

`<ui>/providers/accountant` is `BankProviderAccountant.jsx`, with a hook
`useAccountantHandoff`, a controller and `AccountantHandoffHelper`.

- **State:**
  - `from` / `to` default to `lastFullMonth(new Date())`;
  - `unsentOnly` is `true`;
  - `charges`, `loading`, `error`, `confirming`, `marking` and `success`.
- **Client-side range check:** both dates are required and `from` ≤ `to`. When it fails,
  show an inline validation message and don't call the API.
- **Loading:** the preview loads on open and reloads whenever a date or the toggle changes,
  once the check passes. There is no Preview button. Use `runLoad` / `buildLoadEffect` so a
  stale response from an earlier range is ignored.
  - It calls `AccountantClient.listCharges(context, { from, to, includeSent: !unsentOnly })`.
  - API 400s (future date, > 366 days, > 1000 rows) and other errors are shown with
    `BankErrorAlert`.
- **Preview table:** date, provider (account name linking to `<ui>/providers/:account.id`, plus
  `bank_name`), description, amount (`formatMoney` in the row's currency), currency, and the
  sent date (local date or "—").
  - Show an empty-state message when there are no rows.
  - Under the table, show one totals line per currency, using `sumAmounts` grouped by currency.
    Never show a single grand total.
- **Download CSV:**
  - builds from the loaded rows: `downloadText(accountantCsvFilename(from, to),
    buildAccountantCsv(charges), { mimeType: 'text/csv;charset=utf-8' })`;
  - is disabled while a load is in flight;
  - is allowed on an empty preview, where it gives a header-only CSV (edge case 9).
- **Mark as sent:**
  - is enabled only when the loaded preview has rows, and disabled while loading or marking;
  - opens `ConfirmModal` ("Mark N charges as sent?", `confirmLabel` "Mark as sent");
  - on confirm, posts the loaded ids through `markSent(context, ids)`;
  - on success, reloads the preview and shows a success alert "N charges marked as sent";
  - shows errors with `BankErrorAlert`;
  - does not require a download first.
- **Back link** to `<ui>/providers`.

Split into small private renderers (range inputs, toggle, table, totals, actions) to stay
within the complexity and line limits.

Specs (both contexts) cover:
- the defaults (last full month, unsent only, with `include_sent=false` in the first request);
- a reload on a date change and on a toggle change;
- no request on an invalid range;
- rendering rows and per-currency totals (BRL and USD lines);
- Download CSV called with exactly the loaded rows and the right filename, using a faked
  download module;
- Mark as sent disabled when empty, confirm then post the ids, then reload and the success text;
- the 400 surfaced through `BankErrorAlert`;
- buttons disabled during a load.

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/pages/BankProviderAccountant.jsx` (new)
- `frontend/assets/js/components/resources/bank/providers/pages/hooks/useAccountantHandoff.js` (new)
- `frontend/assets/js/components/resources/bank/providers/pages/controllers/AccountantHandoffController.js` (new)
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/AccountantHandoffHelper.jsx` (new; split into sub-helpers if it nears 300 lines)
- `frontend/assets/js/components/resources/bank/providers/common/chargeTotals.js` (new) — group by currency + `sumAmounts`
- `frontend/assets/js/components/helpers/AppHelper.jsx` — wire `bank-provider-accountant`
- `frontend/specs/assets/js/components/resources/bank/providers/pages/BankProviderAccountantSpec.js`, `.../helpers/AccountantHandoffHelperSpec.js`, `.../controllers/AccountantHandoffControllerSpec.js`, `frontend/specs/assets/js/components/resources/bank/providers/common/chargeTotalsSpec.js` (new)
