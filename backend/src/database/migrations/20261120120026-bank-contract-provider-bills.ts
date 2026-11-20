import type { MigrationInterface, QueryRunner } from 'typeorm';

const DETAILS = 'bank_provider_expense_details';
const BILLS = 'bank_provider_bills';
const PAYING_ACCOUNT_FK = 'fk_bank_provider_expense_details_paying_account';

/** The seven provider-level schedule columns, with their original definitions. */
export const SCHEDULE_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['expected_amount', 'BIGINT NULL'],
  ['charge_frequency', "VARCHAR(16) NOT NULL DEFAULT 'monthly'"],
  ['due_day', 'TINYINT NULL'],
  ['due_month', 'TINYINT NULL'],
  ['bills_from', 'DATE NULL'],
  ['show_in_calendar', 'TINYINT(1) NOT NULL DEFAULT 1'],
  ['paying_account_id', 'INT NULL'],
];

/** `up`: drops the paying-account FK and the seven schedule columns in one statement. */
export const DROP_SCHEDULE_SQL = `ALTER TABLE \`${DETAILS}\`
  DROP FOREIGN KEY \`${PAYING_ACCOUNT_FK}\`,
  ${SCHEDULE_COLUMNS.map(([name]) => `DROP COLUMN \`${name}\``).join(',\n  ')}`;

/** `down`: re-adds the paying-account FK (`ON DELETE SET NULL`). */
export const ADD_FK_CLAUSE = `ADD CONSTRAINT \`${PAYING_ACCOUNT_FK}\` FOREIGN KEY (\`paying_account_id\`)
    REFERENCES \`bank_accounts\` (\`id\`) ON DELETE SET NULL`;

/**
 * `down`: copies the schedule of each provider's single recurring bill back
 * onto its details row. One-off bills are ignored; providers with zero or
 * several recurring bills are not matched and keep `NULL` / the defaults.
 */
export const BACKFILL_SQL = `UPDATE \`${DETAILS}\` d
  JOIN (
    SELECT \`provider_account_id\`, MIN(\`id\`) AS \`bill_id\`
    FROM \`${BILLS}\` WHERE \`kind\` = 'recurring'
    GROUP BY \`provider_account_id\` HAVING COUNT(*) = 1
  ) single ON single.\`provider_account_id\` = d.\`account_id\`
  JOIN \`${BILLS}\` b ON b.\`id\` = single.\`bill_id\`
  SET d.\`expected_amount\` = b.\`expected_amount\`,
    d.\`charge_frequency\` = COALESCE(b.\`charge_frequency\`, 'monthly'),
    d.\`due_day\` = b.\`due_day\`,
    d.\`due_month\` = b.\`due_month\`,
    d.\`bills_from\` = b.\`bills_from\`,
    d.\`show_in_calendar\` = COALESCE(b.\`show_in_calendar\`, 1),
    d.\`paying_account_id\` = b.\`paying_account_id\``;

const EXISTS_SQL = (view: string, column: string): string =>
  `SELECT 1 FROM information_schema.\`${view}\` WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND \`${column}\` = ? LIMIT 1`;

/**
 * Contract migration for provider bills: drops the seven provider-level
 * schedule columns (`expected_amount`, `charge_frequency`, `due_day`,
 * `due_month`, `bills_from`, `show_in_calendar`, `paying_account_id`, plus the
 * paying-account FK) from `bank_provider_expense_details`. Since the expand
 * migration, provider bills are the source of truth and these columns were
 * only copies. `for_accountant` and `provider_tax_id` stay.
 *
 * `up` is a single `ALTER TABLE`, skipped when the columns are already gone.
 *
 * `down` is **lossy**: it re-adds the columns (skipping any that already
 * exist, so it can be re-run after a partial failure) and backfills them only
 * for providers with exactly one `recurring` bill. Providers with zero or
 * several recurring bills get `NULL` and the column defaults; one-off bills
 * are ignored. Bill data itself is never touched.
 */
export class BankContractProviderBills20261120120026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.#exists(queryRunner, 'COLUMNS', 'COLUMN_NAME', 'expected_amount'))) {
      return;
    }
    await queryRunner.query(DROP_SCHEDULE_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const clauses: string[] = [];
    for (const [name, definition] of SCHEDULE_COLUMNS) {
      if (!(await this.#exists(queryRunner, 'COLUMNS', 'COLUMN_NAME', name))) {
        clauses.push(`ADD COLUMN \`${name}\` ${definition}`);
      }
    }
    if (!(await this.#exists(queryRunner, 'TABLE_CONSTRAINTS', 'CONSTRAINT_NAME', PAYING_ACCOUNT_FK))) {
      clauses.push(ADD_FK_CLAUSE);
    }
    if (clauses.length > 0) {
      await queryRunner.query(`ALTER TABLE \`${DETAILS}\`\n  ${clauses.join(',\n  ')}`);
    }
    await queryRunner.query(BACKFILL_SQL);
  }

  async #exists(queryRunner: QueryRunner, view: string, column: string, name: string): Promise<boolean> {
    const rows = (await queryRunner.query(EXISTS_SQL(view, column), [DETAILS, name])) as unknown[] | undefined;
    return (rows ?? []).length > 0;
  }
}
