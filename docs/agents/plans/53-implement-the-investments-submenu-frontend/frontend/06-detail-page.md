# Investment detail page, info block and shortcuts

`pages/BankInvestmentDetail.jsx` calls `useAccountDetail(INVESTMENTS_BASE)` and shows
`NotFound` when there is no account. `pages/helpers/BankInvestmentDetailHelper.jsx` calls
`AccountDetailHelper.render(state, handlers, {base: INVESTMENTS_BASE, backLabel: 'Investments', renderHeader, renderShortcuts})`.

**Info block.** `pages/helpers/InvestmentInfoHelper.jsx`, in the style of `DebtInfoHelper`:
- Common entries via `DetailEntry`: Institution, Currency, Start date, Notes. No opening
  balance.
- Then `<h2>Investment info</h2>` and a `<dl aria-label="Investment info">` with:
  - Kind (`KIND_LABELS`);
  - Yield rate (`formatRate(yield_rate, yield_period)`);
  - Maturity date;
  - Liquidity (`formatLiquidity`, "D+N").
- Blank values show `—`.

**Shortcuts.** `B/investments/common/InvestmentShortcuts.jsx`, built on the common
`AccountShortcuts`:
- `applicationPreset()` → `{direction: 'in', description: 'Application', amount: ''}`.
- `withdrawalPreset()` → `{direction: 'out', description: 'Withdrawal', amount: ''}`.
- Both go through the existing `handlers.onStartNew(preset)`, so the discard confirmation and
  the positive typed amount stored signed come for free.
- The whole bar, including Update value, is hidden on an archived investment. The plain inline
  add stays.

**Update value.**
- Add a small form with Current value (in the account currency) and Date (default
  `localToday()`).
- Its state lives in a hook, `useUpdateValueForm` (values, errors, pending, notice).
- On submit:
  1. Parse the value with `parseAmount` (`allowNegative` false, `allowZero` true).
  2. Compute `diff = subtractAmounts(value, account.balance, currency)`.
  3. If `diff` is 0, post nothing and show "Value unchanged".
  4. Otherwise call `client.createTransaction(ctx, id, {date, amount: diff, description: 'Yield'})`,
     then reload the account and the ledger, and reset the form.
  5. On an error, show `BankErrorAlert` / `classifyError`.
- The date follows the same rule as ledger dates (not after local today).
- Plumbing: extend `useAccountDetail` so slot renderers can reach `reload`, and have the
  section page merge its extra handlers and state in. For example, `useAccountDetail` returns
  `reload`, and `BankInvestmentDetail` passes `{...handlers, updateValue}` to the helper.
  Optionally, `renderShortcuts` also receives the state. Keep the Accounts and Debts call
  sites working unchanged.

Specs:
- The info block content.
- The ledger as for regular accounts.
- Add application: In, "Application", positive amount.
- Add withdrawal: posts a negative amount, "Withdrawal".
- Update value:
  - posts a positive Yield;
  - posts a negative Yield;
  - with a 0 difference, posts nothing and shows "Value unchanged";
  - reloads after posting;
  - handles a validation error and an API error.
- The plain inline add is still present.
- All shortcuts are hidden when archived.
- Both contexts.
- Escaped name, institution and notes.

## Files to Change
- `assets/js/components/resources/bank/investments/pages/BankInvestmentDetail.jsx` (new)
- `assets/js/components/resources/bank/investments/pages/helpers/BankInvestmentDetailHelper.jsx` (new)
- `assets/js/components/resources/bank/investments/pages/helpers/InvestmentInfoHelper.jsx` (new)
- `assets/js/components/resources/bank/investments/common/InvestmentShortcuts.jsx` (new)
- `assets/js/components/resources/bank/investments/common/shortcutPresets.js` (new)
- `assets/js/components/resources/bank/investments/common/UpdateValueForm.jsx` and `useUpdateValueForm.js` (new)
- `assets/js/components/resources/bank/common/detail/hooks/useAccountDetail.js` — expose `reload` / allow extra handlers
- `assets/js/components/resources/bank/common/detail/helpers/AccountDetailHelper.jsx` — pass state to slots if needed
- Matching specs
