import type { DataSource } from 'typeorm';
import { columnInfo, indexNames, tableNames } from './schema-inspection.js';
import { createTestDataSource, resetDatabase, runMigrationsUpTo } from './test-data-source.js';

const ACCOUNTS = 'bank_accounts';
const TRANSACTIONS = 'bank_transactions';
const DEBT_DETAILS = 'bank_debt_details';
const INVESTMENT_DETAILS = 'bank_investment_details';
const PROVIDER_EXPENSE_DETAILS = 'bank_provider_expense_details';

interface Owner {
  userId?: number | null;
  organizationId?: number | null;
}

const BILLS = 'bank_bills';
const BILL_PAYMENTS = 'bank_bill_payments';
const SCHEDULE_TABLES = [DEBT_DETAILS, PROVIDER_EXPENSE_DETAILS];

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

function insertInvestmentDetails(ds: DataSource, accountId: number): Promise<unknown> {
  return ds.query(`INSERT INTO ${INVESTMENT_DETAILS} (account_id, kind, yield_rate, yield_period) VALUES (?, 'fund', 12.5, 'yearly')`, [
    accountId,
  ]);
}

function insertProviderExpenseDetails(ds: DataSource, accountId: number): Promise<unknown> {
  return ds.query(`INSERT INTO ${PROVIDER_EXPENSE_DETAILS} (account_id, provider_tax_id, expected_amount) VALUES (?, '12.345.678/0001-90', 20000)`, [
    accountId,
  ]);
}

async function insertBill(ds: DataSource, providerId: number, payingId: number | null = null): Promise<number> {
  const result: { insertId: number } = await ds.query(
    `INSERT INTO ${BILLS} (provider_account_id, paying_account_id, due_date, amount, description) VALUES (?, ?, '2026-03-10', 5000, 'Tax')`,
    [providerId, payingId],
  );
  return result.insertId;
}

async function insertPayment(ds: DataSource, fields: Record<string, unknown>): Promise<number> {
  const row = { bill_id: null, due_date: '2026-03-10', status: 'skipped', ...fields };
  const columns = Object.keys(row);
  const result: { insertId: number } = await ds.query(
    `INSERT INTO ${BILL_PAYMENTS} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(row),
  );
  return result.insertId;
}

async function indexColumns(ds: DataSource, table: string, index: string): Promise<string[]> {
  const rows: Array<{ column: string }> = await ds.query(
    `SELECT COLUMN_NAME AS \`column\` FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? ORDER BY SEQ_IN_INDEX`,
    [table, index],
  );
  return rows.map(({ column }) => column);
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

    it('creates sent_to_accountant_at as a nullable datetime with no default', async () => {
      expect(await columnInfo(ds, TRANSACTIONS, 'sent_to_accountant_at')).toMatchObject({
        type: 'datetime',
        nullable: true,
        default: null,
      });
    });

    it('leaves sent_to_accountant_at NULL on a new transaction', async () => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'Nubank');
      await insertTransaction(ds, accountId);

      expect(await ds.query(`SELECT sent_to_accountant_at AS sent FROM ${TRANSACTIONS}`)).toEqual([{ sent: null }]);
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

  describe('bank_investment_details', () => {
    it('creates the columns with their types and nullability', async () => {
      expect(await columnInfo(ds, INVESTMENT_DETAILS, 'account_id')).toMatchObject({ type: 'int', nullable: false });
      expect(await columnInfo(ds, INVESTMENT_DETAILS, 'kind')).toMatchObject({ type: 'varchar(16)', nullable: true });
      expect(await columnInfo(ds, INVESTMENT_DETAILS, 'yield_rate')).toMatchObject({ type: 'decimal(7,4)', nullable: true });
      expect(await columnInfo(ds, INVESTMENT_DETAILS, 'yield_period')).toMatchObject({ type: 'varchar(16)', nullable: true });
      expect(await columnInfo(ds, INVESTMENT_DETAILS, 'maturity_date')).toMatchObject({ type: 'date', nullable: true });
      expect(await columnInfo(ds, INVESTMENT_DETAILS, 'liquidity_days')).toMatchObject({ type: 'int', nullable: true });
    });

    it('uses account_id as the primary key', async () => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'CDB');
      await insertInvestmentDetails(ds, accountId);

      await expect(insertInvestmentDetails(ds, accountId)).rejects.toThrow(/Duplicate entry/);
    });

    it('rejects details of an unknown account', async () => {
      await expect(insertInvestmentDetails(ds, 999999)).rejects.toThrow(/foreign key constraint fails/);
    });

    it('deletes the details with their account (FK ON DELETE CASCADE)', async () => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'CDB');
      await insertInvestmentDetails(ds, accountId);

      await ds.query(`DELETE FROM ${ACCOUNTS} WHERE id = ?`, [accountId]);

      expect(await ds.query(`SELECT account_id FROM ${INVESTMENT_DETAILS}`)).toEqual([]);
    });
  });

  describe('bank_provider_expense_details', () => {
    it('creates the columns with their types, nullability and defaults', async () => {
      expect(await columnInfo(ds, PROVIDER_EXPENSE_DETAILS, 'account_id')).toMatchObject({ type: 'int', nullable: false });
      expect(await columnInfo(ds, PROVIDER_EXPENSE_DETAILS, 'for_accountant')).toMatchObject({
        type: expect.stringMatching(/^tinyint/),
        nullable: false,
        default: '1',
      });
      expect(await columnInfo(ds, PROVIDER_EXPENSE_DETAILS, 'provider_tax_id')).toMatchObject({ type: 'varchar(32)', nullable: true });
      expect(await columnInfo(ds, PROVIDER_EXPENSE_DETAILS, 'expected_amount')).toMatchObject({ type: 'bigint', nullable: true });
      expect(await columnInfo(ds, PROVIDER_EXPENSE_DETAILS, 'due_day')).toMatchObject({ type: 'tinyint', nullable: true });
      expect(await columnInfo(ds, PROVIDER_EXPENSE_DETAILS, 'charge_frequency')).toMatchObject({
        type: 'varchar(16)',
        nullable: false,
        default: 'monthly',
      });
      expect(await columnInfo(ds, PROVIDER_EXPENSE_DETAILS, 'due_month')).toMatchObject({ type: 'tinyint', nullable: true });
    });

    it('uses account_id as the primary key', async () => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'Accountant');
      await insertProviderExpenseDetails(ds, accountId);

      await expect(insertProviderExpenseDetails(ds, accountId)).rejects.toThrow(/Duplicate entry/);
    });

    it('rejects details of an unknown account', async () => {
      await expect(insertProviderExpenseDetails(ds, 999999)).rejects.toThrow(/foreign key constraint fails/);
    });

    it('deletes the details with their account (FK ON DELETE CASCADE)', async () => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'Accountant');
      await insertProviderExpenseDetails(ds, accountId);

      await ds.query(`DELETE FROM ${ACCOUNTS} WHERE id = ?`, [accountId]);

      expect(await ds.query(`SELECT account_id FROM ${PROVIDER_EXPENSE_DETAILS}`)).toEqual([]);
    });
  });

  describe('bank_bills', () => {
    it('creates the columns and the (provider_account_id, due_date) index', async () => {
      expect(await columnInfo(ds, BILLS, 'provider_account_id')).toMatchObject({ type: 'int', nullable: false });
      expect(await columnInfo(ds, BILLS, 'paying_account_id')).toMatchObject({ type: 'int', nullable: true });
      expect(await columnInfo(ds, BILLS, 'due_date')).toMatchObject({ type: 'date', nullable: false });
      expect(await columnInfo(ds, BILLS, 'amount')).toMatchObject({ type: 'bigint', nullable: false });
      expect(await columnInfo(ds, BILLS, 'description')).toMatchObject({ type: 'varchar(255)', nullable: false });
      expect(await columnInfo(ds, BILLS, 'notes')).toMatchObject({ type: 'text', nullable: true });
      expect(await indexColumns(ds, BILLS, 'idx_bank_bills_provider_due')).toEqual(['provider_account_id', 'due_date']);
    });

    it('deletes the bills with their provider (CASCADE) and nulls a deleted paying account (SET NULL)', async () => {
      const provider = await insertAccount(ds, { userId: 1 }, 'Provider');
      const paying = await insertAccount(ds, { userId: 1 }, 'Checking');
      const kept = await insertAccount(ds, { userId: 1 }, 'Other provider');
      await insertBill(ds, provider);
      const keptBill = await insertBill(ds, kept, paying);

      await ds.query(`DELETE FROM ${ACCOUNTS} WHERE id IN (?, ?)`, [provider, paying]);

      expect(await ds.query(`SELECT id, paying_account_id AS payingId FROM ${BILLS}`)).toEqual([{ id: keptBill, payingId: null }]);
    });

    it('rejects a bill of an unknown provider', async () => {
      await expect(insertBill(ds, 999999)).rejects.toThrow(/foreign key constraint fails/);
    });
  });

  describe('bank_bill_payments', () => {
    it('creates the columns, the keys and the (source_account_id, due_date) index', async () => {
      expect(await columnInfo(ds, BILL_PAYMENTS, 'status')).toMatchObject({ type: 'varchar(16)', nullable: false });
      expect(await columnInfo(ds, BILL_PAYMENTS, 'paid_on')).toMatchObject({ type: 'date', nullable: true });
      expect(await columnInfo(ds, BILL_PAYMENTS, 'amount')).toMatchObject({ type: 'bigint', nullable: true });
      expect(await columnInfo(ds, BILL_PAYMENTS, 'derived_due_date')).toMatchObject({ type: 'date', nullable: true });
      expect(await indexColumns(ds, BILL_PAYMENTS, 'idx_bank_bill_payments_source_due')).toEqual(['source_account_id', 'due_date']);
      expect(await indexColumns(ds, BILL_PAYMENTS, 'uq_bank_bill_payments_bill')).toEqual(['bill_id']);
      expect(await indexColumns(ds, BILL_PAYMENTS, 'uq_bank_bill_payments_derived')).toEqual(['source_account_id', 'derived_due_date']);
    });

    it('rejects two derived payments for the same account and nominal date', async () => {
      const source = await insertAccount(ds, { userId: 1 }, 'Loan');
      await insertPayment(ds, { source_account_id: source });

      await expect(insertPayment(ds, { source_account_id: source })).rejects.toThrow(/Duplicate entry/);
      await expect(insertPayment(ds, { source_account_id: source, due_date: '2026-04-10' })).resolves.toBeGreaterThan(0);
    });

    it('allows one-off payments of different bills on the same provider and date, but one per bill', async () => {
      const provider = await insertAccount(ds, { userId: 1 }, 'Provider');
      const first = await insertBill(ds, provider);
      const second = await insertBill(ds, provider);
      await insertPayment(ds, { source_account_id: provider });

      await insertPayment(ds, { source_account_id: provider, bill_id: first });
      await expect(insertPayment(ds, { source_account_id: provider, bill_id: second })).resolves.toBeGreaterThan(0);
      await expect(insertPayment(ds, { source_account_id: provider, bill_id: first, due_date: '2026-05-01' })).rejects.toThrow(
        /Duplicate entry/,
      );
    });

    it('cascades from the source account and the bill, and nulls the paying account and transactions', async () => {
      const source = await insertAccount(ds, { userId: 1 }, 'Provider');
      const paying = await insertAccount(ds, { userId: 1 }, 'Checking');
      const bill = await insertBill(ds, source);
      await insertTransaction(ds, source);
      const [{ id: transactionId }]: Array<{ id: number }> = await ds.query(`SELECT id FROM ${TRANSACTIONS}`);
      const kept = await insertPayment(ds, {
        source_account_id: source,
        status: 'paid',
        paid_on: '2026-03-10',
        amount: 5000,
        paying_account_id: paying,
        payment_transaction_id: transactionId,
        withdrawal_transaction_id: transactionId,
        charge_transaction_id: transactionId,
      });
      await insertPayment(ds, { source_account_id: source, bill_id: bill });

      await ds.query(`DELETE FROM ${BILLS} WHERE id = ?`, [bill]);
      await ds.query(`DELETE FROM ${TRANSACTIONS} WHERE id = ?`, [transactionId]);
      await ds.query(`DELETE FROM ${ACCOUNTS} WHERE id = ?`, [paying]);

      expect(await ds.query(
        `SELECT id, paying_account_id AS paying, payment_transaction_id AS p, withdrawal_transaction_id AS w,
                charge_transaction_id AS c FROM ${BILL_PAYMENTS}`,
      )).toEqual([{ id: kept, paying: null, p: null, w: null, c: null }]);

      await ds.query(`DELETE FROM ${ACCOUNTS} WHERE id = ?`, [source]);
      expect(await ds.query(`SELECT id FROM ${BILL_PAYMENTS}`)).toEqual([]);
    });
  });

  describe('schedule fields', () => {
    it.each(SCHEDULE_TABLES)('adds bills_from, show_in_calendar and paying_account_id to %s', async (table) => {
      expect(await columnInfo(ds, table, 'bills_from')).toMatchObject({ type: 'date', nullable: true, default: null });
      expect(await columnInfo(ds, table, 'show_in_calendar')).toMatchObject({
        type: expect.stringMatching(/^tinyint/),
        nullable: false,
        default: '1',
      });
      expect(await columnInfo(ds, table, 'paying_account_id')).toMatchObject({ type: 'int', nullable: true, default: null });
    });

    it.each(SCHEDULE_TABLES)('defaults show_in_calendar to true on %s', async (table) => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'Source');
      await ds.query(`INSERT INTO ${table} (account_id) VALUES (?)`, [accountId]);

      expect(await ds.query(`SELECT show_in_calendar AS shown, bills_from AS billsFrom FROM ${table}`)).toEqual([
        { shown: 1, billsFrom: null },
      ]);
    });

    it.each(SCHEDULE_TABLES)('rejects an unknown paying account on %s', async (table) => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'Source');

      await expect(ds.query(`INSERT INTO ${table} (account_id, paying_account_id) VALUES (?, 999999)`, [accountId])).rejects.toThrow(
        /foreign key constraint fails/,
      );
    });

    it.each(SCHEDULE_TABLES)('sets paying_account_id to NULL when the paying account is deleted on %s', async (table) => {
      const accountId = await insertAccount(ds, { userId: 1 }, 'Source');
      const payingId = await insertAccount(ds, { userId: 1 }, 'Checking');
      await ds.query(`INSERT INTO ${table} (account_id, paying_account_id) VALUES (?, ?)`, [accountId, payingId]);

      await ds.query(`DELETE FROM ${ACCOUNTS} WHERE id = ?`, [payingId]);

      expect(await ds.query(`SELECT paying_account_id AS payingId FROM ${table}`)).toEqual([{ payingId: null }]);
    });
  });

  describe('schedule fields backfill', () => {
    beforeEach(async () => {
      await resetDatabase(ds);
      await runMigrationsUpTo(ds, 'BankAddTransactionsSentToAccountantAt20261108120021');
    });

    it.each(SCHEDULE_TABLES)('sets bills_from to today on %s rows with a due_day, NULL otherwise', async (table) => {
      const scheduled = await insertAccount(ds, { userId: 1 }, 'Scheduled');
      const unscheduled = await insertAccount(ds, { userId: 1 }, 'Unscheduled');
      await ds.query(`INSERT INTO ${table} (account_id, due_day) VALUES (?, 10), (?, NULL)`, [scheduled, unscheduled]);

      await ds.runMigrations();

      const rows: Array<{ id: number; billsFrom: string | null }> = await ds.query(
        `SELECT account_id AS id, DATE_FORMAT(bills_from, '%Y-%m-%d') AS billsFrom FROM ${table} ORDER BY account_id`,
      );
      const [{ today }]: Array<{ today: string }> = await ds.query("SELECT DATE_FORMAT(UTC_DATE(), '%Y-%m-%d') AS today");
      expect(rows).toEqual([
        { id: scheduled, billsFrom: today },
        { id: unscheduled, billsFrom: null },
      ]);
    });
  });

  describe('down', () => {
    it('drops the bill tables, then the schedule fields, then sent_to_accountant_at, then bank_provider_expense_details, bank_investment_details, bank_debt_details, then bank_transactions, then bank_accounts', async () => {
      await ds.undoLastMigration();
      expect(await tableNames(ds)).not.toContain(BILL_PAYMENTS);
      expect(await tableNames(ds)).not.toContain(BILLS);
      expect(await columnInfo(ds, DEBT_DETAILS, 'bills_from')).toBeDefined();

      await ds.undoLastMigration();
      for (const table of SCHEDULE_TABLES) {
        expect(await columnInfo(ds, table, 'bills_from')).toBeUndefined();
        expect(await columnInfo(ds, table, 'show_in_calendar')).toBeUndefined();
        expect(await columnInfo(ds, table, 'paying_account_id')).toBeUndefined();
      }
      expect(await columnInfo(ds, TRANSACTIONS, 'sent_to_accountant_at')).toBeDefined();

      await ds.undoLastMigration();
      expect(await columnInfo(ds, TRANSACTIONS, 'sent_to_accountant_at')).toBeUndefined();
      expect(await tableNames(ds)).toContain(PROVIDER_EXPENSE_DETAILS);

      await ds.undoLastMigration();
      expect(await tableNames(ds)).not.toContain(PROVIDER_EXPENSE_DETAILS);
      expect(await tableNames(ds)).toContain(INVESTMENT_DETAILS);

      await ds.undoLastMigration();
      expect(await tableNames(ds)).not.toContain(INVESTMENT_DETAILS);
      expect(await tableNames(ds)).toContain(DEBT_DETAILS);

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
