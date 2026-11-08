# Adjust `AccountService` for debts

Targeted changes in `backend/src/bank/account.service.ts`:

- **Archived check before nested validation.** In `update`, run the archived check
  (`accountArchived()` 409 for any present field other than `name`) **before**
  `handler.validateUpdate`, so any `debt` field on an archived debt → 409 even when invalid.
- **Type mismatch.** A `debt` key on create with `type` ≠ `debt`, or on PATCH of a non-debt
  account → 400 (generic: nested key must equal the account's type).
- **Merged-state PATCH.** Load the stored details for the account (via
  `handler.loadDetails([id])`) and pass them to `handler.validateUpdate`.
- **Currency rescale.** In `#applyCurrency`, after the existing `opening_balance` rescale
  (same 409 `CURRENCY_LOCKED` guard when transactions exist), when the account is a debt and the
  request doesn't send `debt.instalment_amount`, rescale the stored `instalment_amount` to the
  new currency via the handler helper (400 when unrepresentable, e.g. `12.50` BRL → JPY). When
  `instalment_amount` is sent, parse it in the **new** currency.
- **List.** `?type=debt` already flows through `registry.get(type)`; confirm the default
  (`regular`) excludes debts and details are batch-loaded (one query per type).
- Responses (create / PATCH / archive / unarchive / detail / list) include `debt` through the
  existing `serializeAccount(..., { nested })` path — verify every response path loads details.

## Files to Change
- `backend/src/bank/account.service.ts` — ordering, type-mismatch check, merged-state input, instalment rescale.
- `backend/src/bank/account-response.ts` — only if the serializer needs the currency passed to the handler.
- `backend/src/bank/tests/account.service.spec.ts` — unit cases for the above.
