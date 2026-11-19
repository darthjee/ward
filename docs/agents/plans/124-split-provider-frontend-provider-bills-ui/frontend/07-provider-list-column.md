# Provider list bills summary column

**Blocked on #133.** `bills_summary` isn't in the providers list response yet. Read its exact
shape from #133's spec or code before you implement this step. If #133 isn't merged, defer
this step (see Notes in frontend.md).

Add a pure formatter `formatBillsSummary(summary, currency)` to `providerLabels.js`. It
produces strings like `3 bills · R$ 250,00/mo + R$ 1.200,00/yr`:

- N counts every bill, one-offs and recurring bills without an amount included. Use singular
  and plural forms ("1 bill" / "N bills").
- The monthly and yearly recurring sums are shown separately, and a zero part is omitted.
  When both are zero, show only `N bills`.
- Bills without `expected_amount` count toward N but not the sums. One-offs are excluded from
  the sums.
- With no bills, show `—`.
- Money uses `formatMoney` in the provider's currency.

If #133 already returns precomputed sums, the formatter only formats. If it returns raw
amounts, do the summing in the formatter under the same rules.

In `BankProviderListHelper.renderRow`, replace the `formatExpected(...)` column and its
"Expected amount" header with a "Bills" column that uses the new formatter.

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/common/providerLabels.js`: add
  `formatBillsSummary`.
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderListHelper.jsx`:
  switch the column and header.
- Specs: `providerLabelsSpec.js` (each rule: zero parts omitted, monthly only, yearly only, both,
  unpriced bills counted, one-offs excluded, no bills shows `—`, singular / plural) and the
  provider list spec.
