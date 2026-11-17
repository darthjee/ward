# Rename Bill to ProviderBill and add BillPayment.providerBillId

Replace `backend/src/bank/entities/bill.entity.ts` with `entities/provider-bill.entity.ts`:
`@Entity('bank_provider_bills') class ProviderBill`. Its fields:
- `id`, `providerAccountId`, `payingAccountId`, `description`, `notes`, timestamps;
- `kind: 'recurring' | 'one_off'` (export a `ProviderBillKind` type);
- `expectedAmount` (`expected_amount`, bigint with `bigintTransformer`, nullable);
- `dueDate` (nullable string);
- nullable `chargeFrequency`, `dueDay`, `dueMonth`, `billsFrom`, `showInCalendar`.

Do **not** map `recurring_description`. Add `providerBillId: number | null` (`provider_bill_id`)
to `BillPayment`. `derived_due_date` and `provider_bill_due_date` stay unmapped.

Update every importer mechanically: `bank-routes.module.ts`, `bank.module.ts`,
`bill.service.ts`, `bill-payment.writer.ts`, `bill-history.service.ts`, `bill-response.ts`,
`calendar.query.ts`, `calendar.service.ts`, and `occurrence-response.ts`
(`expected: bill.expectedAmount`). Behaviour changes for these files are in steps 04 and 05.

Update the test support:
- `tests/support/build-bank-test-app.ts`: `entity === ProviderBill`.
- `tests/support/in-memory-bank-repos.ts`:
  - The bills repo defaults `kind` to `'one_off'` when not given, and `expectedAmount` replaces
    `amount`.
  - Cascade bills → payments on both `billId` and `providerBillId`.
  - `checkBillPaymentKeys` mirrors the three DB keys: the narrowed debt key (only when both
    `billId` and `providerBillId` are null), `(providerBillId, dueDate)`, and `billId`.
  - Add the `(providerAccountId, description)` uniqueness for `kind = 'recurring'`.
- Specs that build bills: `calendar.e2e-spec.ts`, `calendar-units.spec.ts`,
  `bill-payment.writer.spec.ts`, `bill-payments.e2e-spec.ts`. Change only the construction
  (`ProviderBill`, `expectedAmount`, `kind`), never the assertions.

## Files to Change
- `backend/src/bank/entities/bill.entity.ts` → `backend/src/bank/entities/provider-bill.entity.ts` — rename and new columns.
- `backend/src/bank/entities/bill-payment.entity.ts` — `providerBillId`.
- `backend/src/bank/bank-routes.module.ts`, `backend/src/bank/bank.module.ts` — `forFeature`.
- `backend/src/bank/bill.service.ts`, `bill-payment.writer.ts`, `bill-history.service.ts`, `bill-response.ts`, `calendar.query.ts`, `calendar.service.ts`, `occurrence-response.ts` — type and field rename.
- `backend/src/bank/tests/support/build-bank-test-app.ts`, `backend/src/bank/tests/support/in-memory-bank-repos.ts` — fakes mirror the new schema.
- `backend/src/bank/tests/calendar.e2e-spec.ts`, `calendar-units.spec.ts`, `bill-payment.writer.spec.ts`, `bill-payments.e2e-spec.ts` — construction only.
