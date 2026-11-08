# Extract the header and common form parts into bank/common

Pure refactor, no behaviour change for Accounts. Make the header / archive actions and the
common account form reusable by Debts:

- **Header** (`BankAccountHeaderHelper`): move to `bank/common`, take the section base for the
  Edit / Rename link (`<base>/:id/edit`) and accept a pluggable details renderer (the regular
  `<dl>` of bank / branch / account number for Accounts; the debt info block in step 06).
  Archived banner, Archive / Unarchive / Delete and balance stay shared.
- **Form controller** (`BankAccountFormController` + New / Edit subclasses): move the base to
  `bank/common`, parameterise `detailHash` with the section base, and allow a subclass/config
  hook to build the request body (Debts adds `type` and `debt`, step 07).
- **Form fields** (`accountFormFields.js`): move the common part to `bank/common`
  (`emptyAccountFields`, `fieldsFromAccount`, `validateAccountFields`, `changedFields`,
  `NAME_MAX_LENGTH`) in a shape that debt fields can extend (e.g. compose extra fields /
  validators) rather than copy.
- **Form helper** (`BankAccountFormHelper`): move `renderInput`, `renderNameOnly`, the archived
  notice / settings warning and the common-field rendering to `bank/common`, with label
  overrides (Debts relabels Bank → Creditor, opening date → Loan date, opening balance →
  Amount owed) and a slot for extra fields. Accounts keeps rendering branch / account number.
- `useBankAccountForm` (`buildFieldHandlers`) moves too if Debts needs it as-is.

Run the full suite; Accounts specs (including `BankAccountFormPagesSpec`, header and form
helper specs) must still pass.

## Files to Change
- `components/resources/bank/accounts/pages/helpers/BankAccountHeaderHelper.jsx` → `bank/common/…` — base path + details slot
- `components/resources/bank/accounts/pages/controllers/BankAccountFormController.js` → `bank/common/…` — base path + body hook
- `components/resources/bank/accounts/pages/controllers/BankAccountNewController.js`, `BankAccountEditController.js` — extend the shared base, pass `'/bank/accounts'`
- `components/resources/bank/accounts/pages/controllers/accountFormFields.js` → common part in `bank/common/…`
- `components/resources/bank/accounts/pages/helpers/BankAccountFormHelper.jsx` — split shared rendering into `bank/common/…` with label overrides
- `components/resources/bank/accounts/pages/hooks/useBankAccountForm.js` → `bank/common/…` (if shared)
- `components/resources/bank/accounts/pages/BankAccountNew.jsx`, `BankAccountEdit.jsx`, `BankAccountDetail.jsx` — new imports / params
- Matching specs, moved with their sources
