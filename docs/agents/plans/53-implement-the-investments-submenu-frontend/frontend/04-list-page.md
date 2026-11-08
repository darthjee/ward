# Investments list page

Create `B/investments/pages/BankInvestmentList.jsx` with `useAccountList('investment')`, and
`helpers/BankInvestmentListHelper.jsx`, mirroring `BankDebtList`.

- Header: `AccountListHeader` with title "Investments", `base = INVESTMENTS_BASE`, the
  *Show archived* toggle and `newLabel` "New investment".
- Empty state: `EmptyAccountList` with "No investments yet" and a create button that links to
  `<ui>/investments/new`.
- Columns:
  - name, linking to the detail page;
  - institution (`bank_name`);
  - kind, via a `KIND_LABELS` Map;
  - current value: `formatMoney(balance, currency)`;
  - yield rate: `formatRate(yield_rate, yield_period)`, e.g. "1.1% / month";
  - maturity date;
  - currency.
- Archived rows are marked with `ArchivedBadge`. Rows keep the API order (sorted by name).
- **No total row.**
- Put the kind labels and the "D+N" liquidity formatter in a small shared module, e.g.
  `B/investments/common/investmentLabels.js` (`KIND_LABELS`, `KIND_OPTIONS`,
  `formatLiquidity(days)` → `"D+N"` or `''`). Steps 05 and 06 reuse it.

Specs:
- Columns and formatting.
- No total row.
- The empty state.
- The toggle and the New investment button.
- A row link to the detail page.
- Escaped names and institution.
- Links built from the active context, in both contexts.
- The loader is asked for `type: 'investment'`.

## Files to Change
- `assets/js/components/resources/bank/investments/pages/BankInvestmentList.jsx` (new)
- `assets/js/components/resources/bank/investments/pages/helpers/BankInvestmentListHelper.jsx` (new)
- `assets/js/components/resources/bank/investments/common/investmentLabels.js` (new)
- Matching specs under `specs/assets/js/components/resources/bank/investments/`
