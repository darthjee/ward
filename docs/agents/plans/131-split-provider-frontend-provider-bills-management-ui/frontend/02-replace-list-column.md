# Replace the list column

In `BankProviderListHelper.jsx`:
- Header: replace `<th className="text-end">Expected amount</th>` with
  `<th className="text-end">Bills</th>` in the same position (after Balance).
- Row: replace the Expected cell with a `<td className="text-end">` (no `text-nowrap` on the
  cell itself) that renders `billsSummaryParts(provider.bills_summary, provider.currency)`.
  - `null`: empty cell.
  - Otherwise render each part in its own `<span className="text-nowrap">`. Between the first
    and second part put the separator `' · '`, and between later parts `' + '`. The separators
    sit outside the spans so the line can break there.
  - Consider a small private render helper (e.g. `renderBillsSummary`) to keep `renderRow` short.
- Import `billsSummaryParts` and drop `formatExpected` from the `providerLabels.js` import
  (it is no longer used here). Keep `details` for the For-accountant cell.
- Update the render JSDoc column list. Replace "expected amount with its frequency ("—" when
  unset)" with "bills: count and monthly/yearly sums from `bills_summary` ("—" with no bills,
  empty when the field is missing)".

Spec updates in `BankProviderListHelperSpec.js`:
- Add `bills_summary` to the `PROVIDERS` fixtures, for example:
  - id 1 (BRL): `{ count: 3, monthly: '250.00', yearly: '1200.00' }`
  - id 2 (archived, JPY): `{ count: 1, monthly: null, yearly: '1500' }`
  - id 3 (BRL): `{ count: 0, monthly: null, yearly: null }`
  - one more provider (or a per-test override) with no `bills_summary` key.
- The header order test now expects `Bills` instead of `Expected amount`. Add an explicit check
  that `Expected amount` is absent.
- Replace the old `/ month` / `/ year` expected-amount tests with Bills-cell tests:
  - the both-sums text (count, `·`, monthly, `+`, yearly)
  - the archived provider's cell follows the same rules (`1 bill · ¥1,500 / year` via
    `formatMoney`)
  - `—` for `count: 0`
  - empty cell for a missing `bills_summary` (no `—` in that row)
  - each part wrapped in a `text-nowrap` span (`containsAttribute` / `containsTag`)
- Keep the "tolerates a null `provider_expense`" test, since For-accountant still reads it.

## Files to Change
- `frontend/assets/js/components/resources/bank/providers/pages/helpers/BankProviderListHelper.jsx`: Bills header and cell, imports, JSDoc
- `frontend/specs/assets/js/components/resources/bank/providers/pages/helpers/BankProviderListHelperSpec.js`: fixtures and column specs
