# Parameterise shared bank/common pieces

Extend `bank/common` with the optional hooks Providers needs. Every addition is opt-in, so
Accounts, Debts and Investments render exactly as before and their specs stay green.

1. **Ledger per-row slot.**
   - Add an optional `renderRowExtra(transaction)` to `LedgerTableHelper.render`'s state.
     Render it inside the description cell, after the notes.
   - It must render even when `readOnly`, because Mark as unsent stays available on an archived
     account (edge case 5) while the Edit / Delete column is dropped.
   - Thread it through `AccountDetailHelper.render` options as `renderRowExtra(transaction,
     handlers, state)`.
2. **Confirm kinds.**
   - Refactor `AccountDetailHelper`'s private `renderConfirm` to look up a title, body and
     `confirmLabel` per `confirmation.kind` in a `Map`. The kinds are `account`,
     `transaction` and the new `sentEdit`.
   - When the transaction to delete has `sent_to_accountant_at`, append the warning "This charge
     was already sent to the accountant…" to the delete body.
   - The `sentEdit` kind uses `confirmLabel` "Save". Its `pending` also covers
     `form.pending`.
3. **Save-time confirmation in `detailHandlers.js`.**
   - `onSubmit` checks `form.editing?.sent_to_accountant_at`. When it is set, `onSubmit`
     calls `setConfirmation({ kind: 'sentEdit' })` instead of submitting.
   - `onConfirm` dispatches `sentEdit` to `ledgerController.submit(form, {currency, page})`
     and then closes the modal.
   - Keep each function under complexity 10. Use a dispatch `Map` keyed by kind.
4. **Branch / account-number renderer.**
   - Move the private branch + account-number renderer out of
     `accounts/pages/helpers/BankAccountFormHelper.jsx` into a shared, label-parameterised
     piece, e.g. `common/form/helpers/BankExtrasHelper.jsx` with
     `render(state, handlers, { labels })`.
   - Default labels are "Branch" / "Account number". Regular accounts use it unchanged.
5. **Checkbox field.** Add `common/form/AccountFormCheckbox.jsx` (`{name, label, state,
   onChange}`, a Bootstrap `form-check`). Its change handler emits a boolean.
6. **Amount sum.** Add `sumAmounts(decimals, currency)` to `common/amounts.js`. It is built on
   the private BigInt `toMinorUnits` / `fromMinorUnits` and returns a decimal string. If
   `amounts.js` would pass 300 lines, put it in a new `common/amountSums.js` instead.
7. **List header link slot.** Give `AccountListHeader` an optional `children` / `extraLinks`
   slot rendered beside the **New …** button. It is used for the **Accountant hand-off** link.
8. **Last full month.** Add `lastFullMonth(now)` → `{ from, to }` (local `YYYY-MM-DD`) to
   `common/dates.js`. For example, `2026-03-15` gives `2026-02-01`..`2026-02-28`, and
   January gives the previous year's December.

Add or extend the specs for each piece, including the archived + `renderRowExtra` case, the
three confirm kinds and `sumAmounts` across exponents (BRL 2, JPY 0).

## Files to Change
- `frontend/assets/js/components/resources/bank/common/detail/helpers/LedgerTableHelper.jsx` — optional row-extra slot (also when read-only)
- `frontend/assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx` — thread `renderRowExtra`; per-kind confirm map; sent-charge delete warning; `sentEdit` kind
- `frontend/assets/js/components/resources/bank/common/detail/controllers/detailHandlers.js` — sent-edit confirmation on submit; `onConfirm` dispatch
- `frontend/assets/js/components/resources/bank/common/form/helpers/BankExtrasHelper.jsx` (new) — shared branch / account-number renderer with labels
- `frontend/assets/js/components/resources/bank/accounts/pages/helpers/BankAccountFormHelper.jsx` — use the shared renderer
- `frontend/assets/js/components/resources/bank/common/form/AccountFormCheckbox.jsx` (new) — boolean field
- `frontend/assets/js/components/resources/bank/common/amounts.js` (or new `common/amountSums.js`) — `sumAmounts`
- `frontend/assets/js/components/resources/bank/common/list/AccountListHeader.jsx` — extra link slot
- `frontend/assets/js/components/resources/bank/common/dates.js` — `lastFullMonth`
- `frontend/specs/assets/js/components/resources/bank/common/...` — specs for each piece (`LedgerTableHelperSpec`, `AccountDetailHelperSpec`, `detailHandlersSpec`, `AccountFormCheckboxSpec`, `BankExtrasHelperSpec`, `amountsSpec`, `AccountListHeaderSpec`, `datesSpec`)
