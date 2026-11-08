# Investment create / edit pages

Mirror the Debts form pages, using the common pieces from step 01.

- `pages/controllers/investmentFormFields.js`:
  - `INVESTMENT_FIELD_NAMES`;
  - `emptyInvestmentFields(currency, today)`: `opening_balance: '0'`, all investment fields
    blank;
  - `investmentFieldsFromAccount(account)`;
  - `validateInvestmentFields(fields, {nameOnly, now})`:
    - the common validation, with the "Start date" label;
    - `rateEntries` on `yield_rate` / `yield_period`, with the error "Choose the yield period";
    - `kind` in the enum, or null;
    - `maturity_date` any valid date, or null (past allowed, no "not in the future" rule);
    - `liquidity_days` via `integerIn(0..2147483647)`;
    - the body is `{...common, investment: {...}}`, with every key present (null when empty);
  - `changedInvestmentFields`, via `changedNestedFields(body, original, 'investment')`.
- `pages/controllers/BankInvestmentFormController.js` extends `AccountFormController` with
  `base: INVESTMENTS_BASE`. It overrides `validate` / `fieldsFrom` / `changes` / `sendCreate`
  (`client.createInvestment`) / `sendUpdate` (`client.updateInvestment`).
  `BankInvestmentNewController` / `BankInvestmentEditController` follow the Debts ones.
- `pages/helpers/BankInvestmentFormHelper.jsx` calls `AccountFormHelper.render` with:
  - `labels: {bank_name: 'Institution', opening_date: 'Start date'}`;
  - `omitOpeningBalance: true`;
  - `renderExtraFields` (rendered before Notes):
    - Kind: `AccountFormSelect` with `KIND_OPTIONS` and an empty placeholder;
    - Yield rate (%): decimal input;
    - `RatePeriodSelect` for `yield_period`, label "Yield period", shown only once a rate is
      entered;
    - Maturity date;
    - Liquidity (D+N): numeric input.
  - `type` is never shown.
  - Archived accounts keep the name-only form.
- `pages/BankInvestmentNew.jsx` / `BankInvestmentEdit.jsx` via `useAccountNewPage` /
  `useAccountEditPage` (`base: INVESTMENTS_BASE`, so the guard redirects other types from
  `/edit`).

Specs:
- The Institution and Start date labels, including the "Start date …" errors.
- No opening-balance field; create sends `opening_balance: "0"`, and edit does not send it.
- The period is hidden until a rate is typed, and required once it is.
- Emptying a stored rate PATCHes `investment: {yield_rate: null, yield_period: null}`
  (edge case 10).
- Optional Kind / Maturity date / Liquidity / Notes; omitted fields are unchanged on PATCH.
- `type` is not shown.
- Validation messages: rate range and decimals, liquidity as an integer ≥ 0, kind enum.
- Both contexts.

## Files to Change
- `assets/js/components/resources/bank/investments/pages/controllers/investmentFormFields.js` (new)
- `assets/js/components/resources/bank/investments/pages/controllers/BankInvestmentFormController.js` (new)
- `assets/js/components/resources/bank/investments/pages/controllers/BankInvestmentNewController.js` (new)
- `assets/js/components/resources/bank/investments/pages/controllers/BankInvestmentEditController.js` (new)
- `assets/js/components/resources/bank/investments/pages/helpers/BankInvestmentFormHelper.jsx` (new)
- `assets/js/components/resources/bank/investments/pages/BankInvestmentNew.jsx` (new)
- `assets/js/components/resources/bank/investments/pages/BankInvestmentEdit.jsx` (new)
- Matching specs
