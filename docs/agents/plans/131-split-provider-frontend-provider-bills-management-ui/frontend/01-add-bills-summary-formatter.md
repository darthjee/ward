# Add the bills summary formatter

Add a pure, exported function to `providerLabels.js`, next to `formatExpected`:

```js
/**
 * Split a provider's `bills_summary` into the parts of the provider list's Bills cell.
 *
 * @param {{count: number, monthly: string|null, yearly: string|null}|null|undefined} summary
 * @param {string} currency - The provider's ISO 4217 currency.
 * @returns {string[]|null} E.g. ["3 bills", "R$ 250,00 / month", "R$ 1.200,00 / year"];
 *   [EMPTY_MARK] when the provider has no bills; null when the summary is missing.
 */
export function billsSummaryParts(summary, currency) { ... }
```

Rules:
- `summary` is `null` or `undefined`: return `null`. The cell renders empty, not `—`.
- `summary.count` is falsy (0): return `[EMPTY_MARK]`.
- Otherwise the first part is `` `${count} ${count === 1 ? 'bill' : 'bills'}` ``.
- Then add `formatInstalment(summary.monthly, 'monthly', currency)` when monthly is non-zero, and
  `formatInstalment(summary.yearly, 'yearly', currency)` when yearly is non-zero. Treat a value as
  zero when it is `null`, `undefined`, `''`, or `Number(value) === 0` (covers `"0.00"`). Use a
  small private `isZeroSum` helper.

Optionally also export `formatBillsSummary(summary, currency)`. It joins the parts into one string
(`parts[0]`, then `' · '`, then the sums joined with `' + '`; `''` for `null`) so specs can assert
the full text. The component in step 02 uses the parts directly.

Add Jasmine specs in `providerLabelsSpec.js` under a new `describe('billsSummaryParts')` (and
`formatBillsSummary` if added). Compare against `formatMoney(...) + ' / month'` the same way the
existing `formatExpected` specs do. Cover:
- monthly only, yearly only, both
- recurring bills without an expected amount (count > 0, both sums `null`): count only
- one-offs only (count > 0, sums `"0.00"`): count only
- `null` vs `"0.00"` sums both omitted
- `count: 0`: `['—']`
- `1 bill` vs `2 bills`
- missing summary (`undefined` and `null`): `null`

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/common/providerLabels.js`: add `billsSummaryParts` (and optionally `formatBillsSummary`) with JSDoc, plus the private zero-check helper
- `frontend/specs/assets/js/components/resources/bank/providers/common/providerLabelsSpec.js`: add the formatter specs
