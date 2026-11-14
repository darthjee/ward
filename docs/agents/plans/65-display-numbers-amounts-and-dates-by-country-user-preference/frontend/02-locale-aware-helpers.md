# Locale-aware amounts, rates, month and currency names

Paths are under `frontend/assets/js/components/resources/bank/common/`. Replace `undefined`
with `DisplayLocale.get()` in every **display** `Intl` call, keeping signatures unchanged so the
~16 call sites need no edit:

- `amounts.js` `formatMoney(decimal, currency)` — `new Intl.NumberFormat(DisplayLocale.get(),
  { style: 'currency', currency })`. Update its JSDoc (it currently defers to this issue).
  `parseAmount` and `currencyDigits` unchanged.
- `dates.js` `monthName(month)` — `Intl.DateTimeFormat(DisplayLocale.get(), { month: 'long' })`.
- `currencies.js` private `displayNames(intl)` — `new intl.DisplayNames(DisplayLocale.get(),
  { type: 'currency' })`. Because currency names change with the locale, sorting in
  `currencyOptions` should use the same locale (`localeCompare(other, DisplayLocale.get())`) if
  it sorts by name.
- `rates.js` `formatRate(rate, period)` — render the rate as a locale number with the API
  string's own precision (fraction digits = length of the decimal part of the string, no
  rounding, no padding), then `%`: e.g. `'1.5'` → `1,5%` in `pt-BR`, `1.5%` in `en-US`.
  Use `Intl.NumberFormat(DisplayLocale.get(), { minimumFractionDigits: n,
  maximumFractionDigits: n })`. Null/empty keeps today's behaviour. `formatInstalment` already
  goes through `formatMoney`.

Specs (update the existing ones, which build expectations with `Intl(undefined, …)`, and add
locale cases):

- `amountsSpec.js` — `pt-BR` → `R$ 1.234,56`-style, `en-US` → `$1,234.56`, store cleared →
  browser default (same `Intl(undefined, …)` expectation as today); `parseAmount` still accepts
  `1234.56` and `1234,56` with `pt-BR` and `en-US` set.
- `datesSpec.js` — `monthName(3)` in `pt-BR` (`março`) and `en-US` (`March`).
- `currenciesSpec.js` — the injected `fakeIntl` receives the stored locale.
- `ratesSpec.js` — `'1.5'`, `'12.345'`, `'3'` in `pt-BR` / `en-US`, precision preserved.

## Files to Change

- `frontend/assets/js/components/resources/bank/common/amounts.js`
- `frontend/assets/js/components/resources/bank/common/dates.js`
- `frontend/assets/js/components/resources/bank/common/currencies.js`
- `frontend/assets/js/components/resources/bank/common/rates.js`
- `frontend/specs/assets/js/components/resources/bank/common/amountsSpec.js`
- `frontend/specs/assets/js/components/resources/bank/common/datesSpec.js`
- `frontend/specs/assets/js/components/resources/bank/common/currenciesSpec.js`
- `frontend/specs/assets/js/components/resources/bank/common/ratesSpec.js`
