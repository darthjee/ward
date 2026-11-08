import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableForeignKey, TableIndex } from 'typeorm';
import { createdAtColumn, idColumn, updatedAtColumn } from './helpers.js';

const TRANSACTIONS = 'bank_transactions';

/**
 * Creates the Bank module's `bank_transactions` table (see
 * `docs/agents/specs/banking/accounts/transactions.md`). A transaction never
 * stores an owner: it inherits it through its account. `account_id` is a
 * **real** FK (both tables belong to `bank`) with `ON DELETE RESTRICT`, so the
 * DB refuses to delete an account that has transactions. The
 * `(account_id, date, id)` index serves the ledger order, the running
 * balance, the derived opening and the balance sums (and backs the FK).
 * `amount` is signed integer minor units.
 */
export class BankCreateTransactions20261108120017 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: TRANSACTIONS,
        columns: [
          idColumn(),
          { name: 'account_id', type: 'int' },
          { name: 'date', type: 'date' },
          { name: 'amount', type: 'bigint' },
          { name: 'description', type: 'varchar', length: '255' },
          { name: 'notes', type: 'text', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
        indices: [
          new TableIndex({
            name: 'idx_bank_transactions_account_id_date_id',
            columnNames: ['account_id', 'date', 'id'],
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_bank_transactions_account_id',
            columnNames: ['account_id'],
            referencedTableName: 'bank_accounts',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`${TRANSACTIONS}\``);
  }
}
