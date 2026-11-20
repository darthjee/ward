# Remove compatibility aliases and the provider branch of billSourceOf

The account-level occurrence payment and `bill-payments.json` routes serve `debt` accounts only.
A `provider_expense` account gets the same uniform `404` as an unknown or foreign account.

## Resolver

In `backend/src/bank/bill-source.resolver.ts` (L35-45), accept only `DEBT_TYPE` and throw
`ownerNotFound()` otherwise. Do **not** change `BILL_SOURCE_TYPES`: `calendar.query.ts` still
needs both types. With this change, `history()` in `bill-history.service.ts` 404s for providers
automatically. Keep its `offSchedule` provider-bill branch, which `historyForBill` uses, and
update the JSDoc that mentions providers.

## Pay / undo aliases

In `backend/src/bank/bill-payment.service.ts`:

- Delete the `source.kind === 'provider'` branches (L88-90, L140-142) and `#soleRecurringBillId`
  (L165-180).
- Drop the now-unused `ProviderBillPaymentService` dependency and the `ProviderBill` import.
- Fix the class JSDoc and the param JSDoc.

Check the module wiring (`bank.module.ts`) for the removed constructor argument.

## billSourceOf

In `backend/src/bank/bill-schedule.ts`:

- Delete the provider branch of `billSourceOf`. It becomes debt-only and always returns
  `kind: 'debt'`.
- Narrow `SourceDetails` to the debt details. `typeFields` is simplified accordingly.

`billSourceOfProviderBill` stays; step 04 handles its kind.

## Specs

- `backend/src/bank/tests/bill-payments.e2e-spec.ts`:
  - provider pay/undo tests that use the account-level `pay`/`undo` helpers move to
    `payBill`/`undoBill`, the per-bill routes;
  - the alias test (~L585-603) becomes a test that `GET bill-payments.json`, `POST` and `DELETE`
    `occurrences/:date/payment.json` all return `404` for a provider account, with a status and
    body identical to the foreign-account `404`;
  - the history test (~L636) moves to the per-bill history route, or asserts the `404`;
  - debt tests are unchanged.
- `backend/src/bank/tests/bill-history.spec.ts`:
  - replace the provider built via `billSourceOf` (L59) with a debt, or with
    `billSourceOfProviderBill`;
  - add a `BillSourceResolver` case: a provider account gives `ownerNotFound`.
- `backend/src/bank/tests/calendar-units.spec.ts`: remove the `billSourceOf` provider case
  (L52-70). Build `providerSource` (L263, L278) with `billSourceOfProviderBill`.

## Files to Change

- `backend/src/bank/bill-source.resolver.ts`: debt-only, uniform `404` otherwise.
- `backend/src/bank/bill-history.service.ts`: JSDoc only, behavior via the resolver.
- `backend/src/bank/bill-payment.service.ts`: drop the provider alias branches and the
  dependency.
- `backend/src/bank/bank.module.ts`: constructor wiring, if needed.
- `backend/src/bank/bill-schedule.ts`: `billSourceOf` becomes debt-only; narrow `SourceDetails`.
- `backend/src/bank/tests/bill-payments.e2e-spec.ts`,
  `backend/src/bank/tests/bill-history.spec.ts` and
  `backend/src/bank/tests/calendar-units.spec.ts`: as above.
