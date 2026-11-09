import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'bank_transactions';
const COLUMN_NAME = 'sent_to_accountant_at';

/**
 * Adds the nullable `sent_to_accountant_at` `DATETIME` to `bank_transactions`: the accountant
 * hand-off mark of provider-expense charges, set only by Mark as sent and cleared by Mark as
 * unsent. Existing rows stay `NULL` (no backfill); no index (the preview walks the existing
 * `(account_id, date, id)` index).
 */
export class BankAddTransactionsSentToAccountantAt20261108120021 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({ name: COLUMN_NAME, type: 'datetime', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(TABLE_NAME, COLUMN_NAME);
  }
}
