# Extract and parameterise shared pieces in bank/common

Move the debt-only code that investments also need into `bank/common`, parameterised, and
switch Debts (and Accounts where relevant) over to it. This is a pure refactor: every existing
Accounts and Debts spec must still pass, with only import paths and call shapes adjusted. Add
specs for each new common module.

1. **Form: hide the opening balance and relabel the date errors.**
   - `AccountFormHelper.render` gets an option to omit the opening-balance input, e.g.
     `omitOpeningBalance: true`.
   - `emptyAccountFields` already sets `opening_balance: '0'`, so create still sends `"0"`.
     On edit, the stored `"0.00"` is dropped by the diff, so PATCH does not send it.
   - `validateAccountFields` takes the opening-date label (default "Opening date"), so its
     errors can read "Start date is required" / "Start date cannot be in the future".
2. **Rate plus paired period validation.** Extract `RATE_PATTERN`, `rateEntries`, `PERIODS`,
   `integerIn` and `text` from `debtFormFields.js` into e.g. `B/common/form/controllers/nestedFields.js`.
   - `rateEntries` is parameterised by the rate and period field names and the period error
     message. An empty rate yields both fields `null`.
   - `integerIn` is reused for `liquidity_days` (0..2147483647).
3. **Nested-object diff.** Generalise `changedDebtFields(body, original)` to
   `changedNestedFields(body, original, key)`, which drops `key` when nothing in it changed.
   `changedDebtFields` becomes a thin wrapper, or its callers are updated.
4. **Period select shown once a rate is entered.**
   - Extract `renderInterestPeriod` and `PERIOD_OPTIONS` from `BankDebtFormHelper.jsx` into a
     common component, e.g. `B/common/form/RatePeriodSelect.jsx`.
   - Props: `{rateName, periodName, label, state, onChange}`. It returns `null` while the rate
     is blank.
5. **Shortcut bar.** Generalise `DebtShortcuts` into a common component, e.g.
   `B/common/detail/AccountShortcuts.jsx`.
   - Props: `{account, shortcuts: [[label, variant, preset]], onStartNew, children}`.
   - It renders nothing when `account.archived_at` is set. The `children` slot is where the
     Update value form will go.
   - `DebtShortcuts` becomes a thin configuration of it.
6. **Decimal subtraction.** Add `subtractAmounts(a, b, currency)` to `B/common/amounts.js`.
   - Work in BigInt minor units with `currencyDigits`, and return a decimal string.
   - Add `isZeroAmount`, or compare the result against zero.
7. **List table scaffold (optional, if it stays small).** If an investment list helper would
   repeat `BankDebtListHelper`'s `renderRow` / `renderBody` structure, extract a common list
   table helper that takes columns. Otherwise keep the per-section helpers and accept the
   small duplication.
8. Refresh the JSDoc / comments that mention only "Accounts, Debts" or "debt" in the touched
   files (`rates.js`, `AccountFormHelper`, `AccountDetailHelper`, `useAccountList`,
   `BankAccountDetailController`).

## Files to Change
- `assets/js/components/resources/bank/common/form/helpers/AccountFormHelper.jsx` — option to omit the opening balance
- `assets/js/components/resources/bank/common/form/controllers/accountFormFields.js` — configurable opening-date label in the errors
- `assets/js/components/resources/bank/common/form/controllers/nestedFields.js` (new) — `rateEntries`, `integerIn`, `text`, `PERIODS`, `changedNestedFields`
- `assets/js/components/resources/bank/common/form/RatePeriodSelect.jsx` (new) — the conditional period select
- `assets/js/components/resources/bank/common/detail/AccountShortcuts.jsx` (new) — the generic shortcut bar
- `assets/js/components/resources/bank/common/amounts.js` — `subtractAmounts`
- `assets/js/components/resources/bank/debts/pages/controllers/debtFormFields.js` — use the extracted helpers
- `assets/js/components/resources/bank/debts/pages/helpers/BankDebtFormHelper.jsx` — use `RatePeriodSelect`
- `assets/js/components/resources/bank/debts/common/DebtShortcuts.jsx` — use `AccountShortcuts`
- `assets/js/components/resources/bank/common/rates.js` — JSDoc only (`formatRate` already works for `yield_rate` / `yield_period`)
- `specs/assets/js/components/resources/bank/common/...` — specs for the new and changed common modules
