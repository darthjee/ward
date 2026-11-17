import type { MigrationInterface, QueryRunner } from 'typeorm';

const OLD_BILLS = 'bank_bills';
const BILLS = 'bank_provider_bills';
const PAYMENTS = 'bank_bill_payments';
const DETAILS = 'bank_provider_expense_details';

const PROVIDER_PAYMENTS_FROM = `FROM \`${PAYMENTS}\` p
  JOIN \`bank_accounts\` a ON a.\`id\` = p.\`source_account_id\` AND a.\`type\` = 'provider_expense'
  WHERE p.\`bill_id\` IS NULL`;

/** Pre-flight: provider payments sharing the same nominal due date (ids and dates only). */
export const DUPLICATE_PAYMENTS_SQL = `SELECT p.\`source_account_id\` AS account_id, p.\`due_date\` AS due_date
  ${PROVIDER_PAYMENTS_FROM}
  GROUP BY p.\`source_account_id\`, p.\`due_date\` HAVING COUNT(*) > 1`;

/** Pre-flight: backfilled recurring rows that would share `(account, description)`. */
export const DUPLICATE_DESCRIPTIONS_SQL = `SELECT a.\`id\` AS account_id
  FROM \`${DETAILS}\` d
  JOIN \`bank_accounts\` a ON a.\`id\` = d.\`account_id\`
  GROUP BY a.\`id\`, a.\`name\` HAVING COUNT(*) > 1`;

/** Pre-flight: provider payments whose provider would get no bill under the backfill. */
export const ORPHAN_PAYMENTS_SQL = `SELECT p.\`id\` AS payment_id, p.\`source_account_id\` AS account_id, p.\`due_date\` AS due_date
  ${PROVIDER_PAYMENTS_FROM}
  AND NOT EXISTS (SELECT 1 FROM \`${DETAILS}\` d WHERE d.\`account_id\` = p.\`source_account_id\`)`;

const RENAME_SQL = `RENAME TABLE \`${OLD_BILLS}\` TO \`${BILLS}\``;

export const ALTER_BILLS_SQL = `ALTER TABLE \`${BILLS}\`
  ADD COLUMN \`kind\` VARCHAR(16) NOT NULL DEFAULT 'one_off',
  ADD COLUMN \`charge_frequency\` VARCHAR(16) NULL,
  ADD COLUMN \`due_day\` TINYINT NULL,
  ADD COLUMN \`due_month\` TINYINT NULL,
  ADD COLUMN \`bills_from\` DATE NULL,
  ADD COLUMN \`show_in_calendar\` BOOLEAN NULL,
  MODIFY COLUMN \`due_date\` DATE NULL,
  CHANGE COLUMN \`amount\` \`expected_amount\` BIGINT NULL`;

const BILL_COLUMNS = `\`provider_account_id\`, \`paying_account_id\`, \`kind\`, \`description\`, \`expected_amount\`,
  \`charge_frequency\`, \`due_day\`, \`due_month\`, \`bills_from\`, \`show_in_calendar\`, \`created_at\`, \`updated_at\``;

/** Backfill: one recurring bill per scheduled provider (archived accounts included). */
export const BACKFILL_SCHEDULED_SQL = `INSERT INTO \`${BILLS}\` (${BILL_COLUMNS})
  SELECT d.\`account_id\`, d.\`paying_account_id\`, 'recurring', a.\`name\`, d.\`expected_amount\`,
    d.\`charge_frequency\`, d.\`due_day\`, d.\`due_month\`, d.\`bills_from\`, d.\`show_in_calendar\`, NOW(), NOW()
  FROM \`${DETAILS}\` d
  JOIN \`bank_accounts\` a ON a.\`id\` = d.\`account_id\`
  WHERE d.\`due_day\` IS NOT NULL`;

/** Backfill: a hidden recurring bill for unscheduled providers that already have derived payments. */
export const BACKFILL_HIDDEN_SQL = `INSERT INTO \`${BILLS}\` (${BILL_COLUMNS})
  SELECT d.\`account_id\`, d.\`paying_account_id\`, 'recurring', a.\`name\`, d.\`expected_amount\`,
    COALESCE(d.\`charge_frequency\`, 'monthly'),
    DAY(pp.\`latest\`),
    IF(d.\`charge_frequency\` = 'yearly', MONTH(pp.\`latest\`), NULL),
    COALESCE(d.\`bills_from\`, pp.\`earliest\`),
    FALSE, NOW(), NOW()
  FROM \`${DETAILS}\` d
  JOIN \`bank_accounts\` a ON a.\`id\` = d.\`account_id\`
  JOIN (
    SELECT \`source_account_id\`, MAX(\`due_date\`) AS \`latest\`, MIN(\`due_date\`) AS \`earliest\`
    FROM \`${PAYMENTS}\` WHERE \`bill_id\` IS NULL GROUP BY \`source_account_id\`
  ) pp ON pp.\`source_account_id\` = d.\`account_id\`
  WHERE d.\`due_day\` IS NULL`;

export const ADD_PROVIDER_BILL_ID_SQL = `ALTER TABLE \`${PAYMENTS}\`
  ADD COLUMN \`provider_bill_id\` INT NULL,
  ADD INDEX \`idx_bank_bill_payments_provider_bill\` (\`provider_bill_id\`),
  ADD CONSTRAINT \`fk_bank_bill_payments_provider_bill_id\` FOREIGN KEY (\`provider_bill_id\`)
    REFERENCES \`${BILLS}\` (\`id\`) ON DELETE CASCADE`;

export const REPOINT_PAYMENTS_SQL = `UPDATE \`${PAYMENTS}\` p
  JOIN \`${BILLS}\` b ON b.\`provider_account_id\` = p.\`source_account_id\` AND b.\`kind\` = 'recurring'
  SET p.\`provider_bill_id\` = b.\`id\`
  WHERE p.\`bill_id\` IS NULL`;

export const DROP_DERIVED_SQL = `ALTER TABLE \`${PAYMENTS}\`
  DROP INDEX \`uq_bank_bill_payments_derived\`,
  DROP COLUMN \`derived_due_date\``;

export const ADD_DERIVED_SQL = `ALTER TABLE \`${PAYMENTS}\`
  ADD COLUMN \`derived_due_date\` DATE AS (IF(\`bill_id\` IS NULL AND \`provider_bill_id\` IS NULL, \`due_date\`, NULL)) VIRTUAL,
  ADD UNIQUE INDEX \`uq_bank_bill_payments_derived\` (\`source_account_id\`, \`derived_due_date\`),
  ADD COLUMN \`provider_bill_due_date\` DATE AS (IF(\`provider_bill_id\` IS NOT NULL, \`due_date\`, NULL)) VIRTUAL,
  ADD UNIQUE INDEX \`uq_bank_bill_payments_provider_bill\` (\`provider_bill_id\`, \`provider_bill_due_date\`)`;

export const ADD_RECURRING_KEYS_SQL = `ALTER TABLE \`${BILLS}\`
  ADD COLUMN \`recurring_description\` VARCHAR(255) AS (IF(\`kind\` = 'recurring', \`description\`, NULL)) VIRTUAL,
  ADD UNIQUE INDEX \`uq_bank_provider_bills_recurring_description\` (\`provider_account_id\`, \`recurring_description\`),
  ADD INDEX \`idx_bank_provider_bills_provider_kind_description\` (\`provider_account_id\`, \`kind\`, \`description\`)`;

export const RESTORE_DERIVED_SQL = `ALTER TABLE \`${PAYMENTS}\`
  ADD COLUMN \`derived_due_date\` DATE AS (IF(\`bill_id\` IS NULL, \`due_date\`, NULL)) VIRTUAL,
  ADD UNIQUE INDEX \`uq_bank_bill_payments_derived\` (\`source_account_id\`, \`derived_due_date\`)`;

/**
 * Expand migration for provider bills: renames `bank_bills` to
 * `bank_provider_bills`, adds the recurring-schedule columns and `kind`,
 * backfills one recurring bill per provider (hidden when unscheduled but with
 * derived payments), and gives `bank_bill_payments` a `provider_bill_id`.
 *
 * MySQL commits every DDL statement implicitly, so ordering is what keeps it
 * safe: read-only pre-flight checks run before any DDL, and `down` checks
 * the state of each step so it tolerates a partially applied `up`.
 */
export class BankExpandProviderBills20261117120025 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.#preflight(queryRunner);
    await queryRunner.query(RENAME_SQL);
    await queryRunner.query(ALTER_BILLS_SQL);
    await queryRunner.query(BACKFILL_SCHEDULED_SQL);
    await queryRunner.query(BACKFILL_HIDDEN_SQL);
    await queryRunner.query(ADD_PROVIDER_BILL_ID_SQL);
    await queryRunner.query(REPOINT_PAYMENTS_SQL);
    await queryRunner.query(DROP_DERIVED_SQL);
    await queryRunner.query(ADD_DERIVED_SQL);
    await queryRunner.query(ADD_RECURRING_KEYS_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = (await queryRunner.hasTable(BILLS)) ? BILLS : OLD_BILLS;
    await this.#dropRecurringKeys(queryRunner, table);
    await this.#restoreDerived(queryRunner);
    await this.#dropProviderBillId(queryRunner);
    if (await queryRunner.hasColumn(table, 'kind')) {
      await queryRunner.query(`DELETE FROM \`${table}\` WHERE \`kind\` = 'recurring'`);
      await queryRunner.query(
        `ALTER TABLE \`${table}\` DROP COLUMN \`kind\`, DROP COLUMN \`charge_frequency\`, DROP COLUMN \`due_day\`, ` +
          'DROP COLUMN `due_month`, DROP COLUMN `bills_from`, DROP COLUMN `show_in_calendar`',
      );
    }
    if (await queryRunner.hasColumn(table, 'expected_amount')) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` CHANGE COLUMN \`expected_amount\` \`amount\` BIGINT NOT NULL, ` +
          'MODIFY COLUMN `due_date` DATE NOT NULL',
      );
    }
    if (table === BILLS) {
      await queryRunner.query(`RENAME TABLE \`${BILLS}\` TO \`${OLD_BILLS}\``);
    }
  }

  async #preflight(queryRunner: QueryRunner): Promise<void> {
    const checks: [string, string][] = [
      [DUPLICATE_PAYMENTS_SQL, 'Duplicate provider payments (account_id:due_date)'],
      [DUPLICATE_DESCRIPTIONS_SQL, 'Duplicate backfill descriptions (account_id)'],
      [ORPHAN_PAYMENTS_SQL, 'Orphan provider payments (payment_id:account_id:due_date)'],
    ];
    for (const [sql, label] of checks) {
      const rows = ((await queryRunner.query(sql)) ?? []) as Record<string, unknown>[];
      if (rows.length > 0) {
        throw new Error(`${label}: ${rows.map((row) => Object.values(row).map(formatValue).join(':')).join(', ')}`);
      }
    }
  }

  async #dropRecurringKeys(queryRunner: QueryRunner, table: string): Promise<void> {
    const hasKey = (await queryRunner.hasColumn(table, 'recurring_description')) as boolean;
    if (hasKey) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` DROP INDEX \`uq_bank_provider_bills_recurring_description\`, ` +
          'DROP INDEX `idx_bank_provider_bills_provider_kind_description`, DROP COLUMN `recurring_description`',
      );
    }
  }

  async #restoreDerived(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn(PAYMENTS, 'provider_bill_due_date')) {
      await queryRunner.query(
        `ALTER TABLE \`${PAYMENTS}\` DROP INDEX \`uq_bank_bill_payments_provider_bill\`, DROP COLUMN \`provider_bill_due_date\``,
      );
    }
    let hasDerived = await queryRunner.hasColumn(PAYMENTS, 'derived_due_date');
    if (hasDerived && (await queryRunner.hasColumn(PAYMENTS, 'provider_bill_id'))) {
      await queryRunner.query(DROP_DERIVED_SQL);
      hasDerived = false;
    }
    if (!hasDerived) {
      await queryRunner.query(RESTORE_DERIVED_SQL);
    }
  }

  async #exists(queryRunner: QueryRunner, view: string, column: string, name: string): Promise<boolean> {
    const rows = (await queryRunner.query(
      `SELECT 1 FROM information_schema.\`${view}\` WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND \`${column}\` = ? LIMIT 1`,
      [PAYMENTS, name],
    )) as unknown[] | undefined;
    return (rows ?? []).length > 0;
  }

  async #dropProviderBillId(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn(PAYMENTS, 'provider_bill_id'))) {
      return;
    }
    // `getTable` would query `typeorm_metadata` because of the generated columns, so ask `information_schema`.
    if (await this.#exists(queryRunner, 'TABLE_CONSTRAINTS', 'CONSTRAINT_NAME', 'fk_bank_bill_payments_provider_bill_id')) {
      await queryRunner.query(`ALTER TABLE \`${PAYMENTS}\` DROP FOREIGN KEY \`fk_bank_bill_payments_provider_bill_id\``);
    }
    if (await this.#exists(queryRunner, 'STATISTICS', 'INDEX_NAME', 'idx_bank_bill_payments_provider_bill')) {
      await queryRunner.query(`ALTER TABLE \`${PAYMENTS}\` DROP INDEX \`idx_bank_bill_payments_provider_bill\``);
    }
    await queryRunner.query(`ALTER TABLE \`${PAYMENTS}\` DROP COLUMN \`provider_bill_id\``);
  }
}

/**
 * @param {unknown} value - A pre-flight cell (id or date).
 * @returns {string} The cell as `YYYY-MM-DD` for dates, otherwise its string form.
 */
function formatValue(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}
