# Bank config (`BANK_DEFAULT_CURRENCY`) and currency helpers

Add the boot-validated bank configuration and the pure currency arithmetic that every later
step relies on.

## Config

- Write `buildBankConfig(configService)` in `bank/bank.config.ts`, following the `mail.config.ts`
  pattern:
  - read `BANK_DEFAULT_CURRENCY` and trim it;
  - default to `'BRL'` when it is unset or empty;
  - throw an `Error` when the value is not in `Intl.supportedValuesOf('currency')`, so a bad
    value fails startup.

  It returns a frozen `{ defaultCurrency: string }` and is provided under a `BANK_CONFIG` token.
- Add a small **resident** `BankConfigModule` (`bank/bank-config.module.ts`) that provides and
  exports `BANK_CONFIG`.
  - `BankRoutesModule` (step 06) and the lazy `BankModule` (step 04) both import it.
  - Because it is resident, the boot validation runs at startup. If it lived only in the lazy
    module, a bad value would only fail on the first bank request.
  - Import it from `AppModule` now. Step 06 moves it to an import of `BankRoutesModule`.

## Currency helpers

Add `bank/currency.ts` with pure functions:

- `currencyExponent(code)`: `new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits`.
  This gives BRL/USD 2, JPY 0 and BHD 3.
- `isSupportedCurrency(code)`.
- `parseAmount(decimalString, currency): bigint`, which converts a decimal string to minor
  units.
  - It accepts an optional sign and digits with at most `exponent` decimals.
  - It rejects more decimals than the currency allows (for example `"10.555"` for BRL, and any
    decimal for JPY).
  - It rejects zero where the caller asks for a non-zero amount, and `|amount| > 10^13` minor
    units.
  - On invalid input it throws a typed error that the services map to 400.
  - It never goes through `Number` or any float.
- `formatAmount(minor: bigint, currency): string`, which converts minor units back to a decimal
  string in the currency's exponent: `-123456n` with BRL gives `"-1234.56"`, `500n` with JPY
  gives `"500"`.

## Tests

Unit specs for:

- the default, trimming, an unsupported code that throws, and a supported non-BRL code;
- the exponent for BRL, JPY and BHD;
- parse and format round-trips, including the 10¹³ boundary.

## Files to Change

- `backend/src/bank/bank.config.ts` — new: `buildBankConfig`, `BANK_CONFIG` token, `BankConfig` type.
- `backend/src/bank/bank-config.module.ts` — new: resident module exporting `BANK_CONFIG`.
- `backend/src/bank/currency.ts` — new: exponent, parse and format helpers.
- `backend/src/bank/tests/bank.config.spec.ts` — new.
- `backend/src/bank/tests/currency.spec.ts` — new.
- `backend/src/app.module.ts` — import `BankConfigModule` (replaced by `BankRoutesModule` in step 06).
