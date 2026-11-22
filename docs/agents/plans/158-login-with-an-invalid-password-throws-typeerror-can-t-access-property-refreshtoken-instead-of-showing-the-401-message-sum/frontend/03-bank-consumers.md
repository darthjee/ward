# Bank consumers: handle session-expired rejection

After step 01, a failed session recovery rejects. Today the bank pages would classify it as
`transient` and show an error with Retry next to the re-opened login modal. Migrate them to the
"session expiry is silent" rule.

Shared path:
- `components/resources/bank/common/bankErrors.js` `classifyError`: check
  `isSessionExpired(error)` first and return a new `{ kind: 'sessionExpired' }` (or equivalent).
- `components/resources/bank/common/runLoad.js`: drop the `!value` "session expired" branch and
  its JSDoc. In the catch, a session-expired error resets loading and reports nothing.

`runLoad` users: remove the `undefined`/"expired session" guards and JSDoc. They now get either
data or a rejection:
- `bank/common/detail/controllers/BankAccountLoader.js`
- `bank/common/list/controllers/BankAccountsLoader.js`
- `bank/bills/pages/controllers/billFormLoad.js`
- `bank/bills/pages/controllers/billHistoryPageLoad.js`
- `bank/calendar/pages/controllers/CalendarListController.js` and `CalendarMonthController.js`.
  `onError` must not attach a retry error on session expiry.
- `bank/providers/pages/controllers/AccountantHandoffController.js` (`request` and `markSent`)
- `bank/providers/common/hooks/useRecurringBills.js`, `bank/common/form/hooks/usePayingAccounts.js`.
  These ignore errors, so they need only a guard/JSDoc cleanup.

Action controllers. Remove the `undefined` guard. In `handleError`, on session expiry reset
pending/confirm state and return without an alert, `reload()`, `close()` or `onChanged()`:
- `calendar/common/controllers/CalendarActionsController.js`
- `providers/common/controllers/ProviderBillsController.js`
- `providers/common/controllers/MarkUnsentController.js`
- `common/bills/controllers/BillHistoryController.js`
- `common/detail/controllers/BankAccountDetailController.js`
- `common/detail/controllers/LedgerFormController.js`
- `bills/pages/controllers/BillFormController.js` (`destroy` and `submit`)
- `common/form/controllers/AccountFormController.js` (`handleSubmitError`)
- `investments/common/controllers/UpdateValueController.js` (no reload on session expiry)

Specs: replace each "resolves `undefined` → does nothing" case with "rejects with a
session-expired `ApiError` → no error shown, pending reset". Add a `classifyError` case. Affected
specs include `bankErrorsSpec`, `runLoadSpec`, `BankAccountLoaderSpec`, `BankAccountsLoaderSpec`,
`billFormLoadSpec`, `billHistoryPageLoadSpec`, `CalendarListControllerSpec`,
`CalendarActionsControllerSpec`, `ProviderBillsControllerSpec`, `MarkUnsentControllerSpec`,
`AccountantHandoffControllerSpec`, `BillHistoryControllerSpec`, `BankAccountDetailControllerSpec`,
`LedgerFormControllerSpec`, `BillFormControllerSpec`, `BankAccountNewControllerSpec`,
`UpdateValueControllerSpec` and `useRecurringBillsSpec`. Grep `specs/` for `undefined`
resolves of client spies to catch any others.

## Files to Change
- `frontend/assets/js/components/resources/bank/common/bankErrors.js` — `sessionExpired` kind
- `frontend/assets/js/components/resources/bank/common/runLoad.js` — catch skips session expiry
- The bank loaders, controllers and hooks listed above (under `frontend/assets/js/components/resources/bank/`)
- Their matching specs under `frontend/specs/assets/js/components/resources/bank/`
