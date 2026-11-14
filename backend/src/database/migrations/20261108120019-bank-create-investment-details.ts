import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableForeignKey } from 'typeorm';
import { createdAtColumn, updatedAtColumn } from './helpers.js';

const INVESTMENT_DETAILS = 'bank_investment_details';

/**
 * Creates the Bank module's `bank_investment_details` table (see
 * `docs/agents/modules/bank/investment.md`): the 1:1 details of an
 * `investment` account. `account_id` is both the primary key and a **real**
 * FK to `bank_accounts.id` with `ON DELETE CASCADE`. No owner column: the
 * owner comes from the account. `yield_rate` is a percentage with 4 decimals.
 */
export class BankCreateInvestmentDetails20261108120019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: INVESTMENT_DETAILS,
        columns: [
          { name: 'account_id', type: 'int', isPrimary: true },
          { name: 'kind', type: 'varchar', length: '16', isNullable: true },
          { name: 'yield_rate', type: 'decimal', precision: 7, scale: 4, isNullable: true },
          { name: 'yield_period', type: 'varchar', length: '16', isNullable: true },
          { name: 'maturity_date', type: 'date', isNullable: true },
          { name: 'liquidity_days', type: 'int', isNullable: true },
          createdAtColumn(),
          updatedAtColumn(),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'fk_bank_investment_details_account_id',
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
    await queryRunner.query(`DROP TABLE IF EXISTS \`${INVESTMENT_DETAILS}\``);
  }
}
