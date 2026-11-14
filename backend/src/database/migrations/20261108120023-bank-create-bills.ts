import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableForeignKey, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn, updatedAtColumn } from './helpers.js';

const BILLS = 'bank_bills';
const BILL_PAYMENTS = 'bank_bill_payments';

/**
 * @param {string} table - The referencing table.
 * @param {string} column - The FK column.
 * @param {string} referencedTable - The referenced table (its `id`).
 * @param {string} onDelete - The delete rule.
 * @returns {TableForeignKey} The FK, named `fk_<table>_<column>`.
 */
function foreignKey(table: string, column: string, referencedTable: string, onDelete: string): TableForeignKey {
  return new TableForeignKey({
    name: `fk_${table}_${column}`,
    columnNames: [column],
    referencedTableName: referencedTable,
    referencedColumnNames: ['id'],
    onDelete,
  });
}

/**
 * The derived-occurrence unique key, added with raw SQL right after
 * `createTable` (as for `bank_accounts`: a generated column declared through
 * `createTable` would make TypeORM use a `typeorm_metadata` table this project
 * never creates). MySQL has no partial unique index, so "`(source_account_id,
 * due_date)` where `bill_id` is null" is the generated `derived_due_date`
 * plus a unique key on it: one-off rows have a `NULL` there and never collide.
 * The column is `VIRTUAL` (indexed), not `STORED`: MySQL refuses a stored
 * generated column whose base column (`bill_id`) has an `ON DELETE CASCADE`
 * FK.
 */
export const BILL_PAYMENTS_DERIVED_KEY_SQL = `ALTER TABLE \`${BILL_PAYMENTS}\`
  ADD COLUMN \`derived_due_date\` DATE AS (IF(\`bill_id\` IS NULL, \`due_date\`, NULL)) VIRTUAL,
  ADD UNIQUE INDEX \`uq_bank_bill_payments_derived\` (\`source_account_id\`, \`derived_due_date\`)`;

/**
 * Creates the Bank module's bill tables (see `docs/agents/modules/bank/bills.md`):
 * - `bank_bills`, the one-off bills, owned through their provider-expense
 *   account (`ON DELETE CASCADE`), with a default paying account
 *   (`ON DELETE SET NULL`);
 * - `bank_bill_payments`, one row per paid / skipped occurrence keyed by its
 *   **nominal** due date, with real FKs to its source account and bill
 *   (`CASCADE`), its paying account and the transactions it created
 *   (`SET NULL`). `UNIQUE (bill_id)` covers one-offs; the derived key is
 *   added by {@link BILL_PAYMENTS_DERIVED_KEY_SQL}.
 *
 * No table stores an owner. Amounts are integer minor units. `down` drops the
 * tables with raw SQL (payments first).
 */
export class BankCreateBills20261108120023 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: BILLS,
        columns: [
          idColumn(),
          { name: 'provider_account_id', type: 'int' },
          { name: 'paying_account_id', type: 'int', isNullable: true },
          { name: 'due_date', type: 'date' },
          { name: 'amount', type: 'bigint' },
          { name: 'description', type: 'varchar', length: '255' },
          { name: 'notes', type: 'text', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
        indices: [new TableIndex({ name: 'idx_bank_bills_provider_due', columnNames: ['provider_account_id', 'due_date'] })],
        foreignKeys: [
          foreignKey(BILLS, 'provider_account_id', 'bank_accounts', 'CASCADE'),
          foreignKey(BILLS, 'paying_account_id', 'bank_accounts', 'SET NULL'),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: BILL_PAYMENTS,
        columns: [
          idColumn(),
          { name: 'source_account_id', type: 'int' },
          { name: 'bill_id', type: 'int', isNullable: true },
          { name: 'due_date', type: 'date' },
          { name: 'status', type: 'varchar', length: '16' },
          { name: 'paid_on', type: 'date', isNullable: true },
          { name: 'amount', type: 'bigint', isNullable: true },
          { name: 'paying_account_id', type: 'int', isNullable: true },
          { name: 'payment_transaction_id', type: 'int', isNullable: true },
          { name: 'withdrawal_transaction_id', type: 'int', isNullable: true },
          { name: 'charge_transaction_id', type: 'int', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
        indices: [
          new TableIndex({ name: 'uq_bank_bill_payments_bill', columnNames: ['bill_id'], isUnique: true }),
          new TableIndex({ name: 'idx_bank_bill_payments_source_due', columnNames: ['source_account_id', 'due_date'] }),
        ],
        foreignKeys: [
          foreignKey(BILL_PAYMENTS, 'source_account_id', 'bank_accounts', 'CASCADE'),
          foreignKey(BILL_PAYMENTS, 'bill_id', BILLS, 'CASCADE'),
          foreignKey(BILL_PAYMENTS, 'paying_account_id', 'bank_accounts', 'SET NULL'),
          foreignKey(BILL_PAYMENTS, 'payment_transaction_id', 'bank_transactions', 'SET NULL'),
          foreignKey(BILL_PAYMENTS, 'withdrawal_transaction_id', 'bank_transactions', 'SET NULL'),
          foreignKey(BILL_PAYMENTS, 'charge_transaction_id', 'bank_transactions', 'SET NULL'),
        ],
      }),
      true,
    );

    await queryRunner.query(BILL_PAYMENTS_DERIVED_KEY_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`${BILL_PAYMENTS}\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`${BILLS}\``);
  }
}
