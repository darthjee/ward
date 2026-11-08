# Bank common helpers: amounts, currency list, page query

Pure, exhaustively unit-tested helpers in `components/resources/bank/common/` (reused by later
submenus). No React here.

1. **`currencyDigits(currency)`** — `new Intl.NumberFormat(undefined, { style: 'currency',
   currency }).resolvedOptions().maximumFractionDigits` (BRL/USD 2, JPY 0, BHD 3).

2. **`parseAmount(input, { currency, allowNegative, allowZero })`** → `{ value }` (a decimal
   string with `.`) or `{ error }`:
   - trims; accepts digits with **one optional** `.` or `,` decimal separator; optional leading
     `-` only when `allowNegative` (opening balance);
   - rejects thousands separators (`1.234,56`, `1,234.56`) and any other character;
   - rejects more decimals than `currencyDigits(currency)`;
   - rejects zero when `allowZero` is false (transactions);
   - rejects `|amount|` over 10¹³ minor units — compare with string/BigInt arithmetic on the
     digits, never via float;
   - normalises `,` → `.` in the returned string.

3. **Sign mapping** — `toSignedAmount(direction, value)` (`'out'` → `-<value>`, `'in'` →
   `<value>`) and `fromSignedAmount(amount)` → `{ direction, value }` (absolute value string,
   `out` for a leading `-`).

4. **`formatMoney(decimalString, currency)`** — `Intl.NumberFormat(undefined, { style:
   'currency', currency })` on `Number(decimalString)` (safe within the 10¹³ cap); browser
   default locale; display preferences are #65.

5. **Currency list** — `currencyOptions(defaultCode)` → `[{ code, label }]` from
   `Intl.supportedValuesOf('currency')`, labels `BRL — Brazilian Real` via
   `new Intl.DisplayNames(undefined, { type: 'currency' })`, falling back to the bare code when
   no name (or the name equals the code); default first, then A–Z.
   `filterCurrencies(options, text)` — case-insensitive on code and name. Allow injecting the
   `Intl` source for specs.

6. **`pageFromHash(hash)`** — `?page=` via `hashQuery` (step 01): missing / non `^[1-9][0-9]*$`
   → 1.

7. **Date helper** — `localToday()` → `YYYY-MM-DD` from the browser's local date (not UTC), and
   `isAfterLocalToday(date)`.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/amounts.js` — new: `currencyDigits`, `parseAmount`, sign mapping, `formatMoney`
- `frontend/assets/js/components/resources/bank/common/currencies.js` — new: `currencyOptions`, `filterCurrencies`
- `frontend/assets/js/components/resources/bank/common/pageQuery.js` — new: `pageFromHash`
- `frontend/assets/js/components/resources/bank/common/dates.js` — new: `localToday`, `isAfterLocalToday`
- `frontend/specs/assets/js/components/resources/bank/common/amountsSpec.js` — new (all cases listed in the issue's *Pure helper units*)
- `frontend/specs/assets/js/components/resources/bank/common/currenciesSpec.js` — new
- `frontend/specs/assets/js/components/resources/bank/common/pageQuerySpec.js` — new
- `frontend/specs/assets/js/components/resources/bank/common/datesSpec.js` — new
