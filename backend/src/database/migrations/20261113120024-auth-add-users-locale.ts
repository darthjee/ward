import type { MigrationInterface, QueryRunner } from 'typeorm';
import { TableColumn } from 'typeorm';

const TABLE_NAME = 'auth_users';

/**
 * Adds the nullable display `locale` to `auth_users`. No backfill: existing
 * users get `NULL`, meaning "browser default".
 */
export class AuthAddUsersLocale20261113120024 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      TABLE_NAME,
      new TableColumn({ name: 'locale', type: 'varchar', length: '16', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(TABLE_NAME, 'locale');
  }
}
