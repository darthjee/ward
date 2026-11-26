# Statement form (start and edit)

One form serves both start and edit, and the reconcile state's `formKind` tells them apart.

- `B/reconciliation/controllers/statementFields.js`, pure functions:
  - `statementFieldsFor({ statement, account, today })`:
    - start: `{ statement_date: today, statement_balance: '' }`;
    - edit: the statement's values;
    - on a debt (`account.type === 'debt'`), `statement_balance` goes through `negateAmount` on
      load.
  - `validateStatementFields(fields, account)`:
    - requires a date;
    - parses the balance with `parseAmount(input, { currency: account.currency, allowNegative:
      true, allowZero: true })`;
    - returns `{ fieldErrors }` or `{ body }`, where `body` is exactly
      `{ statement_date, statement_balance }`;
    - on a debt the parsed value is negated back with `negateAmount` before submit.
  - `statementBalanceLabel(account)` returns 'Amount owed' for a debt and 'Statement balance'
    otherwise.
  - Do not validate the date `max` client-side. It is only a UX default (`max: today`).
- `B/reconciliation/helpers/StatementFormHelper.jsx`:
  - a plain object with `render(state, handlers)`;
  - a `<form>` with the date input (`AccountFormInput`, `type="date"`, `extra={{ max:
    state.today }}`) and the balance input (`extra={{ inputMode: 'decimal' }}`, labelled by
    `statementBalanceLabel`);
  - the submit button ("Start reconciliation" or "Save statement") and a Cancel-form button that
    only closes the form and sends no request;
  - the `BankErrorAlert` for `state.reconcile.error`;
  - `idPrefix` `statement-`.

Specs:

- `statementFieldsSpec.js`:
  - the date defaults to today;
  - the balance goes through `parseAmount` and an invalid one is rejected;
  - the body is exactly the two keys;
  - debt negation on load and on submit, in both start and edit;
  - the label.
- `StatementFormHelperSpec.js`:
  - the `max` attribute equals today and is asserted as a UX default only;
  - the "Amount owed" label on a debt;
  - the edit form is prefilled;
  - errors are rendered.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/reconciliation/controllers/statementFields.js` — new.
- `frontend/assets/js/components/resources/bank/common/reconciliation/helpers/StatementFormHelper.jsx` — new.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/controllers/statementFieldsSpec.js` — new.
- `frontend/specs/assets/js/components/resources/bank/common/reconciliation/helpers/StatementFormHelperSpec.js` — new.
