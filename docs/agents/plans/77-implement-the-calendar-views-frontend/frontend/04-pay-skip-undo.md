# Pay dialog, Skip and Undo actions

Build the action layer that both views share. It follows the
`BillHistoryController` / `useBillHistory` pattern: a controller class with injectable
`client` and setters, and a hook exporting pure builders.

## PayDialog

A react-bootstrap `Modal` built with `AccountFormInput` / `AccountFormSelect` /
`AccountFormCheckbox`. Its props are
`{ show, occurrence, accounts, state, pending, onChange, onConfirm, onCancel }`.

**Initial fields**, from a pure `initialPayFields(occ, payingOptions, today)`:
- **amount**: `expected_amount`, or `''` when there is none.
- **paid_on**: `localToday()`.
- **paying_account_id**: `default_paying_account.id` when that id is among
  `payingAccountOptions(accounts, occ.currency)` (the non-archived regular accounts), otherwise
  `''`.
- **record_charge**: `true`. The checkbox is rendered only for `kind` `provider` / `bill`.

**Validation**, in a pure `validatePayFields(fields, occ)`:
- the amount is required and parsed with
  `parseAmount(input, {currency: occ.currency})` (> 0);
- paid on is required and not after the local today (`isAfterLocalToday`, message "Date cannot
  be in the future");
- the paying account is required.

## Calendar actions controller and hook

The controller holds the action state:
`{ dialog: null | {type: pay|skip|undo, occurrence}, fields, fieldErrors, pending, error }`.

- **Pay** builds the body (from step 02) and calls `payOccurrence(context,
  source_account.id, nominal_date, body)` or `payBill(context, bill.id, body)`.
  - On success, it closes the dialog and calls `onChanged()` (the view reloads).
  - On `409 OCCURRENCE_ALREADY_PAID`, it closes the dialog, shows the conflict message and
    calls `onChanged()`. This is the "409 reloads the entry" behaviour.
  - On 400 / 422, it keeps the dialog open with the error.
- **Skip** opens a `ConfirmModal` with `confirmLabel="Skip"` and posts `SKIP_BODY` to the same
  route as Pay. Success and 409 are handled like Pay.
- **Undo** opens `UndoPaymentConfirm` with
  `showChargeWarning={undoWarnsCharge({status: occ.status, sourceType: occ.source_account.type, isOneOff: occ.kind === 'bill'})}`.
  - It calls `BillsClient.undoOccurrencePayment(context, source_account.id, nominal_date)` or
    `undoBillPayment(context, bill.id)`.
  - A 404 or a `409 ACCOUNT_ARCHIVED` is shown and then reloads, like
    `BillHistoryController.handleError`.
- Transient errors show `BankErrorAlert` with Retry.
- **Paying accounts** come from `usePayingAccounts(context)`, loaded once per view.

## `CalendarActions`

A component that renders the open dialog: `PayDialog`, the Skip `ConfirmModal` or
`UndoPaymentConfirm`.

## Specs

Cover:
- the amount prefilled from `expected_amount` and required when there is none;
- paid on defaulting to the local today and a future date rejected;
- the paying account prefilled from a valid default and left empty and required when the
  default is `null` or not among the options (archived), with options filtered by currency;
- the charge checkbox shown only for provider / bill entries and checked by default, and
  `record_charge` absent from a debt body;
- Pay / Skip / Undo calling the right client method and route for derived and one-off entries,
  with the nominal date in the path;
- a 409 calling `onChanged`;
- the Undo charge warning.

## Files to Change
- `frontend/assets/js/components/resources/bank/calendar/common/PayDialog.jsx`: new.
- `frontend/assets/js/components/resources/bank/calendar/common/payFields.js`: new, holds
  `initialPayFields` and `validatePayFields`.
- `frontend/assets/js/components/resources/bank/calendar/common/CalendarActions.jsx`: new.
- `frontend/assets/js/components/resources/bank/calendar/common/controllers/CalendarActionsController.js`:
  new.
- `frontend/assets/js/components/resources/bank/calendar/common/hooks/useCalendarActions.js`:
  new.
- Matching specs under `frontend/specs/assets/js/components/resources/bank/calendar/common/`:
  `PayDialogSpec.js`, `payFieldsSpec.js`, `CalendarActionsSpec.js`,
  `controllers/CalendarActionsControllerSpec.js` and `hooks/useCalendarActionsSpec.js`.
