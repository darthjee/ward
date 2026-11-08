import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableForeignKey } from 'typeorm';
import { createdAtColumn, updatedAtColumn } from './helpers.js';

const DEBT_DETAILS = 'bank_debt_details';

/**
 * Creates the Bank module's `bank_debt_details` table (see
 * `docs/agents/specs/banking/accounts/debt.md`): the 1:1 details of a `debt`
 * account. `account_id` is both the primary key and a **real** FK to
 * `bank_accounts.id` with `ON DELETE CASCADE`. No owner column: the owner
 * comes from the account. `instalment_amount` is integer minor units of the
 * account's currency; `interest_rate` is a percentage with 4 decimals.
 */
export class BankCreateDebtDetails20261108120018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: DEBT_DETAILS,
        columns: [
          { name: 'account_id', type: 'int', isPrimary: true },
          { name: 'interest_rate', type: 'decimal', precision: 7, scale: 4, isNullable: true },
          { name: 'interest_period', type: 'varchar', length: '16', isNullable: true },
          { name: 'instalment_amount', type: 'bigint', isNullable: true },
          { name: 'instalment_frequency', type: 'varchar', length: '16', default: "'monthly'" },
          { name: 'due_day', type: 'tinyint', isNullable: true },
          { name: 'due_month', type: 'tinyint', isNullable: true },
          { name: 'instalment_count', type: 'int', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_bank_debt_details_account_id',
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
    await queryRunner.query(`DROP TABLE IF EXISTS \`${DEBT_DETAILS}\``);
  }
}
