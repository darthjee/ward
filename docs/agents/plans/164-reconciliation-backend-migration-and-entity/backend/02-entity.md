# Entity and Transaction change
Create `backend/src/bank/entities/reconciliation.entity.ts`, entity `Reconciliation` on table `bank_reconciliations`. Use the plain-column style of `bill-payment.entity.ts`: no TypeORM relations, since the real FKs live in the migration.
- **Fields:** `id`, `accountId` (`account_id`, int), `statementDate` (`statement_date`, `date`, string `YYYY-MM-DD`), `statementBalance` (`statement_balance`, `bigint` with `transformer: bigintTransformer`), `reconciledAt` (`reconciled_at`, `datetime`, nullable, `Date | null`), and `createdAt` / `updatedAt` through `@CreateDateColumn` / `@UpdateDateColumn`.
- **`open_key`:** do not map it. Document it in the class JSDoc, as `BillPayment` documents its generated columns.
- **State:** state is derived from `reconciledAt`; there is no status column. The `reconciliationStatus()` helper of step 04 exposes it.

Add to `backend/src/bank/entities/transaction.entity.ts`:
`@Column({ name: 'reconciliation_id', type: 'int', nullable: true }) reconciliationId!: number | null;`

Register `Reconciliation` in all three entity lists:
- the resident `TypeOrmModule.forFeature` in `bank/bank-routes.module.ts`;
- the lazy `TypeOrmModule.forFeature` in `bank/bank.module.ts`;
- `ENTITIES` in `database/tests/integration/test-data-source.ts`.

Production picks it up through the `dist/**/*.entity.js` glob.

This step must land together with step 06: the fake data source throws for an unknown entity, so the bank e2e suite fails until step 06 is in.

## Files to Change
- `backend/src/bank/entities/reconciliation.entity.ts` — new entity
- `backend/src/bank/entities/transaction.entity.ts` — `reconciliationId` column
- `backend/src/bank/bank-routes.module.ts` — `forFeature` list
- `backend/src/bank/bank.module.ts` — `forFeature` list
- `backend/src/database/tests/integration/test-data-source.ts` — `ENTITIES`
