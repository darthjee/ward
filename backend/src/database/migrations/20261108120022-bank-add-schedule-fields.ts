import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn, TableForeignKey } from 'typeorm';

const TABLES = ['bank_debt_details', 'bank_provider_expense_details'] as const;

/**
 * @param {string} table - The details table.
 * @returns {string} The name of its `paying_account_id` foreign key.
 */
function payingAccountForeignKey(table: string): string {
  return `fk_${table}_paying_account`;
}

/**
 * Adds the bill schedule fields (see `docs/agents/modules/bank/bills.md`) to
 * `bank_debt_details` and `bank_provider_expense_details`: `bills_from`
 * (nullable `DATE`), `show_in_calendar` (`NOT NULL DEFAULT true`) and the
 * default `paying_account_id` (nullable real FK to `bank_accounts.id`,
 * `ON DELETE SET NULL`). Backfills `bills_from` with the migration's UTC date
 * for rows that already have a `due_day`, so existing schedules show on the
 * Calendar without a phantom overdue backlog.
 */
export class BankAddScheduleFields20261108120022 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.addColumns(table, [
        new TableColumn({ name: 'bills_from', type: 'date', isNullable: true }),
        new TableColumn({ name: 'show_in_calendar', type: 'boolean', isNullable: false, default: true }),
        new TableColumn({ name: 'paying_account_id', type: 'int', isNullable: true }),
      ]);
      await queryRunner.createForeignKey(
        table,
        new TableForeignKey({
          name: payingAccountForeignKey(table),
          columnNames: ['paying_account_id'],
          referencedTableName: 'bank_accounts',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
      await queryRunner.query(`UPDATE \`${table}\` SET bills_from = UTC_DATE() WHERE due_day IS NOT NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.dropForeignKey(table, payingAccountForeignKey(table));
      await queryRunner.dropColumn(table, 'paying_account_id');
      await queryRunner.dropColumn(table, 'show_in_calendar');
      await queryRunner.dropColumn(table, 'bills_from');
    }
  }
}
