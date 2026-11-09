# Add the `sent_to_accountant_at` column
Add a nullable `DATETIME` column `bank_transactions.sent_to_accountant_at`, with no index, no
backfill and no default. Map it on the entity.

- **Migration.** Create `20261108120021-bank-add-transactions-sent-to-accountant-at.ts`, class
  `BankAddTransactionsSentToAccountantAt20261108120021`. It runs after #54's details migration.
  Follow the add-column pattern of `20261018120012-auth-add-refresh-tokens-revoked-reason.ts`:
  `queryRunner.addColumn('bank_transactions', new TableColumn({ name: 'sent_to_accountant_at', type: 'datetime', isNullable: true }))`
  on `up`, and `dropColumn` on `down`.
- **Entity.** Add `@Column({ name: 'sent_to_accountant_at', type: 'datetime', nullable: true }) sentToAccountantAt!: Date | null;`
  to `Transaction`, following the `Account.archivedAt` shape.
- **Migration registry.** Register the migration in the integration `test-data-source.ts`
  `MIGRATIONS` list, and anywhere else the app lists migrations (check how #54's migration was
  registered and mirror it).
- **Unit spec.** Write a migration unit spec on the `fakeQueryRunner` / `asQueryRunner` pattern
  (see `auth-add-refresh-tokens-revoked-reason-migration.spec.ts`). It asserts the `addColumn`
  arguments on `up` and the `dropColumn` on `down`.
- **Leave untouched:** existing migrations and their specs, including
  `bank-create-transactions-migration.spec.ts`, which asserts the column is absent from that
  migration.
- **In-memory repo.** Make sure `tests/support/in-memory-bank-repos.ts` and any transaction
  factories default `sentToAccountantAt` to `null`.

## Files to Change
- `backend/src/database/migrations/20261108120021-bank-add-transactions-sent-to-accountant-at.ts` — new migration
- `backend/src/database/tests/bank-add-transactions-sent-to-accountant-at-migration.spec.ts` — new unit spec
- `backend/src/bank/entities/transaction.entity.ts` — `sentToAccountantAt` column
- `backend/src/database/tests/integration/test-data-source.ts` — register the migration
- `backend/src/database/tests/integration/bank-schema.integration-spec.ts` — check the new column with `columnInfo(ds, 'bank_transactions', 'sent_to_accountant_at')`, and update the `down` test, because `undoLastMigration()` now reverts this migration (the column drops, and the provider details table stays)
- `backend/src/bank/tests/support/in-memory-bank-repos.ts` — default `sentToAccountantAt: null` if needed
