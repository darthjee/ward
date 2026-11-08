# Shared bank components: CurrencySelect, pagination, error alert

React pieces in `components/resources/bank/common/`, reused by every bank page.

1. **`CurrencySelect`** — no new dependency. A text filter input above a native
   `<select size="8">` (keyboard accessible), options from `currencyOptions(defaultCode)` filtered
   by `filterCurrencies` (step 02). Props: `value`, `defaultCode`, `onChange`, `locked`,
   `lockedHint`, `error`, `idPrefix`. Only list codes can be chosen (the select value is the
   submitted value; the filter text is never submitted). Keep the selected option visible even
   when filtered out. `locked` → disabled with a short hint ("Currency can't change once the
   account has transactions"). Shows `is-invalid` / `invalid-feedback` for `error`.

2. **`BankPagination`** — react-bootstrap `Pagination` (`react-bootstrap/cjs/Pagination.js`):
   First / Prev / a window of page numbers (e.g. ±2) / Next / Last; hidden when
   `total_pages <= 1`. Items are links built by a `hrefFor(page)` prop
   (`contextHash(context, '/bank/accounts/12') + '?page=N'`) and an optional `onNavigate(page,
   event)` so the ledger can intercept for the unsaved-form confirmation. Put the window
   computation in a pure helper (`pageWindow(page, totalPages, radius)`) with a spec.

3. **Error presentation helper** — `bankErrors.js` (pure) + `BankErrorAlert.jsx`:
   - `classifyError(error)` → `notFound` (404), `conflict` (409, keeps `code`), `validation`
     (400: `details` when present, else `[message]` — `BAD_REQUEST` has no `details`),
     `transient` (network / 5xx / non-`ApiError`);
   - `BankErrorAlert` renders an inline `alert-danger`; the transient variant is dismissible and
     has a **Retry** button (`onRetry`, `onDismiss`).

4. **`ConfirmModal`** — react-bootstrap `Modal` with confirm / cancel, confirm disabled while
   `pending` (used for Delete in steps 08–09).

## Files to Change
- `frontend/assets/js/components/resources/bank/common/CurrencySelect.jsx` — new
- `frontend/assets/js/components/resources/bank/common/BankPagination.jsx` — new
- `frontend/assets/js/components/resources/bank/common/pageWindow.js` — new
- `frontend/assets/js/components/resources/bank/common/bankErrors.js` — new
- `frontend/assets/js/components/resources/bank/common/BankErrorAlert.jsx` — new
- `frontend/assets/js/components/resources/bank/common/ConfirmModal.jsx` — new
- `frontend/specs/assets/js/components/resources/bank/common/` — `CurrencySelectSpec.js`, `BankPaginationSpec.js`, `pageWindowSpec.js`, `bankErrorsSpec.js`, `BankErrorAlertSpec.js`, `ConfirmModalSpec.js`
