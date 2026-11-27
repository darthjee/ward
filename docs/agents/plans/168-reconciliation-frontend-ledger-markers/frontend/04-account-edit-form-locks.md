# Account edit form locks

## Lock derivation

In `B/form/hooks/useAccountEditPage.js`, extract and export a pure helper, for example
`editLocks(account, ledger)`:

```js
const reconciled = Boolean(account.last_reconciliation || account.open_reconciliation_id);
const hasTransactions = ledger.pagination.total_count > 0;
return {
  currencyLocked: hasTransactions || reconciled,
  openingLocked: reconciled,
  currencyLockReason: reconciled ? 'reconciled' : (hasTransactions ? 'transactions' : null),
};
```

- **Hook state.** The inline `onLoaded` callback uses it, and the hook returns `openingLocked`
  next to `currencyLocked`.
- **Why the currency locks.** It is locked when a statement exists, even with zero
  transactions, because the server answers 409 `CURRENCY_LOCKED` once any statement exists.
- **Reload after a 409.** `mergeLoadedAccount(fields, account, locked, fieldsFrom)` resets only
  `currency` today. Extend it so that `opening_date` / `opening_balance` are also reset from
  `fieldsFrom(account)` when the opening fields are locked, for example after an
  `ACCOUNT_RECONCILED` 409 reload. Use `fieldsFrom`, so a debt's opening balance comes back
  negated (`debtFieldsFromAccount`).

## Form rendering

In `B/form/helpers/AccountFormHelper.jsx`:

- **Read-only opening fields.** When `state.openingLocked`, the `opening_date` `AccountFormInput`
  and `renderOpeningBalance` get `readOnly: true` in `extra`. Merge it with the existing
  `max: localToday()`.
- **Hint.** Render a `<div className="form-text">` hint, exported as `OPENING_LOCKED_HINT`
  (e.g. "Opening date and balance can't change while statements exist — cancel or undo the
  statements first.").
- **Investments.** Investments pass `omitOpeningBalance`, so only the date locks there, and the
  hint still shows.
- **Currency hint.** When the currency lock comes from statements, pass a statement-specific
  `lockedHint` to `CurrencySelect`. The default `LOCKED_HINT` ("once the account has
  transactions") would be wrong here. Keep the default for the transactions-only case.
- **JSDoc.** Update it for `state.openingLocked`.

The debt form (`debts/pages/helpers/BankDebtFormHelper.jsx`) goes through `AccountFormHelper`,
so it inherits the lock. `debtFormFields.js` needs no change: the edit PATCH only sends changed
fields, so an unchanged read-only opening value is never sent.

## Specs

- **`S/form/hooks/useAccountEditPageSpec.js`**, for `editLocks`:
  - neither field set: unlocked, or currency-only when there are transactions;
  - `last_reconciliation` set, or `open_reconciliation_id` set: both locked, **including with
    zero transactions** (the issue's extra currency assertion);
  - `mergeLoadedAccount` resets the opening fields when they are locked, and the debt value is
    negated through `fieldsFrom`.
- **`S/form/helpers/AccountFormHelperSpec.js`**:
  - the opening fields are read-only with the hint when `openingLocked`, and editable without the
    hint otherwise;
  - the statement-specific currency hint.
- **`debts/pages/helpers/BankDebtFormHelperSpec.js`** (under
  `frontend/specs/assets/js/components/resources/bank/`): Loan date and Amount owed are
  read-only with the hint when `openingLocked`.
- **Sibling form specs.** Add `openingLocked: false` to the fixtures of the form helper specs
  for accounts, providers and investments, and of `accounts/pages/BankAccountFormPagesSpec.js`,
  so the defaults stay explicit. Add a locked case for investments (date only).

## Files to Change
- `frontend/assets/js/components/resources/bank/common/form/hooks/useAccountEditPage.js` — `editLocks` helper, `openingLocked` state, and opening reset in `mergeLoadedAccount`
- `frontend/assets/js/components/resources/bank/common/form/helpers/AccountFormHelper.jsx` — read-only opening fields, `OPENING_LOCKED_HINT`, and the currency `lockedHint`
- `frontend/specs/assets/js/components/resources/bank/common/form/hooks/useAccountEditPageSpec.js` — lock derivation and merge cases
- `frontend/specs/assets/js/components/resources/bank/common/form/helpers/AccountFormHelperSpec.js` — locked and unlocked rendering
- `frontend/specs/assets/js/components/resources/bank/debts/pages/helpers/BankDebtFormHelperSpec.js` — debt lock
- `frontend/specs/assets/js/components/resources/bank/investments/pages/helpers/BankInvestmentFormHelperSpec.js` — date-only lock
- `frontend/specs/assets/js/components/resources/bank/accounts/pages/helpers/BankAccountFormHelperSpec.js`, `providers/pages/helpers/BankProviderFormHelperSpec.js`, `accounts/pages/BankAccountFormPagesSpec.js` — fixture defaults
