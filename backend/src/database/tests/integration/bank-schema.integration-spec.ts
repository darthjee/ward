import type { DataSource } from 'typeorm';
import { columnInfo, indexNames, tableNames } from './schema-inspection.js';
import { createTestDataSource, resetDatabase } from './test-data-source.js';

const ACCOUNTS = 'bank_accounts';
const TRANSACTIONS = 'bank_transactions';
const DEBT_DETAILS = 'bank_debt_details';

interface Owner {
  userId?: number | null;
  organizationId?: number | null;
}

async function insertAccount(ds: DataSource, owner: Owner, name: string, archived = false): Promise<number> {
  const result: { insertId: number } = await ds.query(
    `INSERT INTO ${ACCOUNTS} (user_id, organization_id, type, name, currency, opening_date, archived_at)
     VALUES (?, ?, 'regular', ?, 'BRL', '2026-01-01', ?)`,
    [owner.userId ?? null, owner.organizationId ?? null, name, archived ? new Date() : null],
  );
  return result.insertId;
}

function insertTransaction(ds: DataSource, accountId: number): Promise<unknown> {
  return ds.query(
    `INSERT INTO ${TRANSACTIONS} (account_id, date, amount, description) VALUES (?, '2026-01-02', -1250, 'Coffee')`,
    [accountId],
  );
}

function insertDebtDetails(ds: DataSource, accountId: number): Promise<unknown> {
  return ds.query(`INSERT INTO ${DEBT_DETAILS} (account_id, interest_rate, instalment_amount) VALUES (?, 1.99, 50000)`, [
    accountId,
  ]);
}

describe('bank schema (MySQL)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource();
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  describe('bank_accounts', () => {
    it('creates the BIGINT opening balance and the generated name key', async () => {
      expect(await columnInfo(ds, ACCOUNTS, 'opening_balance')).toMatchObject({ type: 'bigint', nullable: false, default: '0' });
      expect(await columnInfo(ds, ACCOUNTS, 'active_name_key')).toMatchObject({ type: 'varchar(255)', nullable: true });
    });

    it('creates the two per-owner unique indexes', async () => {
      expect(await indexNames(ds, ACCOUNTS)).toEqual([
        'idx_bank_accounts_organization_id_active_name_key',
        'idx_bank_accounts_user_id_active_name_key',
        'PRIMARY',
      ]);
    });

    it('rejects a row with both owners', async () => {
      await expect(insertAccount(ds, { userId: 1, organizationId: 2 }, 'Both')).rejects.toThrow(
        /bank_accounts_exactly_one_owner/,
      );
    });

    it('rejects a row with neither owner', async () => {
      await expect(insertAccount(ds, {}, 'Neither')).rejects.toThrow(/bank_accounts_exactly_one_owner/);
    });

    it('rejects a case-insensitive active-name clash within one user', async () => {
      await insertAccount(ds, { userId: 1 }, 'Nubank');

      await expect(insertAccount(ds, { userId: 1 }, 'NUBANK')).rejects.toThrow(/Duplicate entry/);
    });

    it('rejects a case-insensitive active-name clash within one organization', async () => {
      await insertAccount(ds, { organizationId: 7 }, 'Nubank');

      await expect(insertAccount(ds, { organizationId: 7 }, 'nubank')).rejects.toThrow(/Duplicate entry/);
    });

    it('allows the same name for a user and an organization, and in two organizations', async () => {
      await insertAccount(ds, { userId: 1 }, 'Nubank');

      await expect(insertAccount(ds, { organizationId: 1 }, 'Nubank')).resolves.toBeGreaterThan(0);
      await expect(insertAccount(ds, { organizationId: 2 }, 'Nubank')).resolves.toBeGreaterThan(0);
      await expect(insertAccount(ds, { userId: 2 }, 'Nubank')).resolves.toBeGreaterThan(0);
    });

    it('never clashes with an archived name', async () => {
      await insertAccount(ds, { userId: 1 }, 'Nubank', true);
      await insertAccount(ds, { userId: 1 }, 'Nubank', true);

      await expect(insertAccount(ds, { userId: 1 }, 'nubank')).resolves.toBeGreaterThan(0);
    });

    it('rejects archiving being undone onto an active name', async () => {
      const archived = await insertAccount(ds, { userId: 1 }, 'Nubank', true);
      await insertAccount(ds, { userId: 1 }, 'NuBank');

      await expect(ds.query(`UPDATE ${ACCOUNTS} SET archived_at = NULL WHERE id = ?`, [archived])).rejects.toThrow(
        /Duplicate entry/,
      );
    });

    it('does not treat accented and unaccented names as a clash', async () => {
      await insertAccount(ds, { userId: 1 }, 'Itaú');

      await expect(insertAccount(ds, { userId: 1 }, 'Itau')).resolves.toBeGreaterThan(0);
      await expect(insertAccount(ds, { userId: 1 }, 'ITAÚ')).rejects.toThrow(/Duplicate entry/);
    });
  });

  describe('bank_transactions', () => {
    it('creates the (account_id, date, id) index', async () => {
      const rows: Array<{ column: string }> = await ds.query(
        `SELECT COLUMN_NAME AS \`column\` FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? ORDER BY SEQ_IN_INDEX`,
        [TRANSACTIONS, 'idx_bank_transactions_account_id_date_id'],
      );

      expect(rows.map(({ column }) => column)).toEqual(['account_id', 'date', 'id']);
    });

    it('refuses to delete an account that has transactions (FK ON DELETE RESTRICT)', async () => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'Nubank');
      await insertTransaction(ds, accountId);

      await expect(ds.query(`DELETE FROM ${ACCOUNTS} WHERE id = ?`, [accountId])).rejects.toThrow(
        /foreign key constraint fails/,
      );
    });

    it('deletes an account without transactions', async () => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'Nubank');

      await ds.query(`DELETE FROM ${ACCOUNTS} WHERE id = ?`, [accountId]);

      expect(await ds.query(`SELECT id FROM ${ACCOUNTS}`)).toEqual([]);
    });

    it('rejects a transaction of an unknown account', async () => {
      await expect(insertTransaction(ds, 999999)).rejects.toThrow(/foreign key constraint fails/);
    });
  });

  describe('bank_debt_details', () => {
    it('creates the columns with their types, nullability and defaults', async () => {
      expect(await columnInfo(ds, DEBT_DETAILS, 'account_id')).toMatchObject({ type: 'int', nullable: false });
      expect(await columnInfo(ds, DEBT_DETAILS, 'interest_rate')).toMatchObject({ type: 'decimal(7,4)', nullable: true });
      expect(await columnInfo(ds, DEBT_DETAILS, 'interest_period')).toMatchObject({ type: 'varchar(16)', nullable: true });
      expect(await columnInfo(ds, DEBT_DETAILS, 'instalment_amount')).toMatchObject({ type: 'bigint', nullable: true });
      expect(await columnInfo(ds, DEBT_DETAILS, 'instalment_frequency')).toMatchObject({
        type: 'varchar(16)',
        nullable: false,
        default: 'monthly',
      });
      expect(await columnInfo(ds, DEBT_DETAILS, 'due_day')).toMatchObject({ type: 'tinyint', nullable: true });
      expect(await columnInfo(ds, DEBT_DETAILS, 'due_month')).toMatchObject({ type: 'tinyint', nullable: true });
      expect(await columnInfo(ds, DEBT_DETAILS, 'instalment_count')).toMatchObject({ type: 'int', nullable: true });
    });

    it('uses account_id as the primary key', async () => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'Car loan');
      await insertDebtDetails(ds, accountId);

      await expect(insertDebtDetails(ds, accountId)).rejects.toThrow(/Duplicate entry/);
    });

    it('rejects details of an unknown account', async () => {
      await expect(insertDebtDetails(ds, 999999)).rejects.toThrow(/foreign key constraint fails/);
    });

    it('deletes the details with their account (FK ON DELETE CASCADE)', async () => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'Car loan');
      await insertDebtDetails(ds, accountId);

      await ds.query(`DELETE FROM ${ACCOUNTS} WHERE id = ?`, [accountId]);

      expect(await ds.query(`SELECT account_id FROM ${DEBT_DETAILS}`)).toEqual([]);
    });
  });

  describe('down', () => {
    it('drops bank_debt_details, then bank_transactions, then bank_accounts', async () => {
      await ds.undoLastMigration();
      expect(await tableNames(ds)).not.toContain(DEBT_DETAILS);
      expect(await tableNames(ds)).toContain(TRANSACTIONS);

      await ds.undoLastMigration();
      expect(await tableNames(ds)).not.toContain(TRANSACTIONS);
      expect(await tableNames(ds)).toContain(ACCOUNTS);

      await ds.undoLastMigration();
      expect(await tableNames(ds)).not.toContain(ACCOUNTS);
    });
  });
});
