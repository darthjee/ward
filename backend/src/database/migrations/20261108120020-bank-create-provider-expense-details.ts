import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableForeignKey } from 'typeorm';
import { createdAtColumn, updatedAtColumn } from './helpers.js';

const PROVIDER_EXPENSE_DETAILS = 'bank_provider_expense_details';

/**
 * Creates the Bank module's `bank_provider_expense_details` table (see
 * `docs/agents/modules/bank/provider-expense.md`): the 1:1 details
 * of a `provider_expense` account. `account_id` is both the primary key and a
 * **real** FK to `bank_accounts.id` with `ON DELETE CASCADE`. No owner column:
 * the owner comes from the account. `expected_amount` is integer minor units
 * of the account's currency.
 */
export class BankCreateProviderExpenseDetails20261108120020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: PROVIDER_EXPENSE_DETAILS,
        columns: [
          { name: 'account_id', type: 'int', isPrimary: true },
          { name: 'for_accountant', type: 'boolean', default: true },
          { name: 'provider_tax_id', type: 'varchar', length: '32', isNullable: true },
          { name: 'expected_amount', type: 'bigint', isNullable: true },
          { name: 'due_day', type: 'tinyint', isNullable: true },
          { name: 'charge_frequency', type: 'varchar', length: '16', default: "'monthly'" },
          { name: 'due_month', type: 'tinyint', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_bank_provider_expense_details_account_id',
            columnNames: ['account_id'],
            referencedTableName: 'bank_accounts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`${PROVIDER_EXPENSE_DETAILS}\``);
  }
}
