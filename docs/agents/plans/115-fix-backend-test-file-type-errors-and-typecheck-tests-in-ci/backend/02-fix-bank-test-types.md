# Fix bank test type errors
Fix the 12 errors in the bank test sources, using production types where they exist.

- `bill-history.spec.ts:33` (TS2554): `new BillHistoryService(paymentRepository, billRepository, sources, resolver)` takes 4 args; the first test passes 3. Add `{} as never` as the 4th argument (the same as the second describe's `build()`; `history()` does not use the resolver).
- `bill-history.spec.ts:89` (TS2345): `build = (payments, peeked = billA)` infers `peeked` from the recurring fixture (non-null `notes`, `dueDay`, ...), so passing `oneOff` fails. Annotate `peeked: ProviderBill = billA`. Assertions are already correct.
- `calendar.e2e-spec.ts:290-291` (TS18046): import `type { OccurrenceResponse }` from `../occurrence-response.js` and type `const rows = response.body.occurrences as OccurrenceResponse[];`. Then simplify line ~295 `(row.source_account as Body).id` to `row.source_account.id`. Keep `import/order` happy (place after the `../occurrence-generator.js` import; `yarn lint_fix` sorts it).
- `provider-expense-accounts.e2e-spec.ts:173-174` (TS18046): import `type { ProviderExpenseResponse }` from `../account-types/provider-expense-details.js` and read `(trimmed.provider_expense as ProviderExpenseResponse).provider_tax_id` (same for `blank`).
- `support/in-memory-bank-repos.ts:293` (3 x TS2339): the SET-NULL loop iterates `providerExpenseDetails.rows`, but `ProviderExpenseDetails` no longer has `payingAccountId` (it moved to bills). Remove `...providerExpenseDetails.rows` from the array. No behaviour change (the value was always `undefined`).
- `transaction.service.spec.ts:317,326` (TS2345): the root cause is `ORGANIZATION` in `account.test-support.ts` being typed as the full `OwnerContext` union, so `{ ...ORGANIZATION, role: 'user' }` widens to include a `{ kind: 'user', role }` member. Type the fixture as `Extract<OwnerContext, { kind: 'organization' }>`. This also correctly types the `asRole` helper. Leave the deliberate invalid-role cast at line ~293 (`{ ...ORGANIZATION, role: 'guest' } as unknown as OwnerContext`) alone. No edit to `transaction.service.spec.ts` itself is needed; check that none of the ~21 importers of `ORGANIZATION` break.

Run the affected specs afterwards to confirm they still pass.

## Files to Change
- `backend/src/bank/tests/bill-history.spec.ts` — 4th constructor arg, `peeked: ProviderBill`
- `backend/src/bank/tests/calendar.e2e-spec.ts` — `OccurrenceResponse[]` rows
- `backend/src/bank/tests/provider-expense-accounts.e2e-spec.ts` — `ProviderExpenseResponse` cast
- `backend/src/bank/tests/support/in-memory-bank-repos.ts` — drop stale `providerExpenseDetails.rows` from SET-NULL loop
- `backend/src/bank/tests/account.test-support.ts` — narrow `ORGANIZATION` type
