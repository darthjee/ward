# Bill form: kind selector, recurring fields and error mapping

**Render** (`BankBillFormHelper.jsx`):

- A `kind` select (One-off / Recurring), disabled on edit.
- `one_off` shows today's fields.
- `recurring` shows these fields:
  - description;
  - expected amount;
  - frequency;
  - due day;
  - due month, only when the frequency is yearly (reuse the `renderDueMonth` /
    `MONTH_OPTIONS` pattern);
  - bills from;
  - show in calendar;
  - default paying account (`payingAccountOptions(state.accounts, state.currency)`).
- The **show in calendar** checkbox gets the hint *"Untick to stop this bill. Its payment
  history is kept."*, for recurring bills only.
- The provider picker is disabled when editing a recurring bill, because of
  `PROVIDER_BILL_PROVIDER_LOCKED`.
- Keep the render small with private `renderOneOffFields` and `renderRecurringFields`
  methods. `ScheduleFieldsHelper` reads `state.fields.currency`, so either adapt it or render
  the fields directly.

**Error mapping** (`BillFormController.handleError`): follow `AccountFormController`, using a
`Map` from code to field or form placement. 400 validation errors map to field errors, and
404 shows not-found, as today.

| Code | Shown as |
|---|---|
| `PROVIDER_BILL_NAME_TAKEN` | Field `description`: "A recurring bill with this description already exists for this provider" |
| `CURRENCY_MISMATCH` | Field `paying_account_id`: "Account currency must match the provider's" |
| `ACCOUNT_NOT_FOUND` | Field `paying_account_id`: "Account not available" |
| `PROVIDER_BILL_LIMIT` | Form: "This provider already has 50 recurring bills" |
| `ACCOUNT_ARCHIVED` | Form: "The provider is archived" |
| `PROVIDER_BILL_KIND_LOCKED`, `PROVIDER_BILL_PROVIDER_LOCKED` | Form message |
| `PROVIDER_BILL_PAID`, `BILL_PAID` | Form: the existing `BILL_PAID_MESSAGE` |

Any other 409 falls back to the server message. Transient errors keep `retry`.

## Files to Change
- `frontend/assets/js/components/resources/bank/bills/pages/helpers/BankBillFormHelper.jsx`:
  kind select, fields per kind, hint, provider picker lock.
- `frontend/assets/js/components/resources/bank/bills/pages/controllers/BillFormController.js`:
  error-code map.
- Specs under `frontend/specs/assets/js/components/resources/bank/bills/pages/`:
  - kind select disabled on edit;
  - fields per kind, with due month only for yearly;
  - the hint only for recurring bills;
  - the provider picker disabled on recurring edit;
  - one spec per mapped code (field vs. form placement).
