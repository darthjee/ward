import type { DataSource } from 'typeorm';
import { columnInfo, indexNames, tableNames } from './schema-inspection.js';
import { createTestDataSource, resetDatabase, runMigrationsUpTo } from './test-data-source.js';
import { ALTER_BILLS_SQL, BankExpandProviderBills20261117120025 } from '../../migrations/20261117120025-bank-expand-provider-bills.js';
import { BankContractProviderBills20261120120026 } from '../../migrations/20261120120026-bank-contract-provider-bills.js';

const ACCOUNTS = 'bank_accounts';
const TRANSACTIONS = 'bank_transactions';
const DEBT_DETAILS = 'bank_debt_details';
const INVESTMENT_DETAILS = 'bank_investment_details';
const PROVIDER_EXPENSE_DETAILS = 'bank_provider_expense_details';

interface Owner {
  userId?: number | null;
  organizationId?: number | null;
}

const BILLS = 'bank_provider_bills';
const OLD_BILLS = 'bank_bills';
const BILL_PAYMENTS = 'bank_bill_payments';
// The provider-level schedule was dropped by the contract migration: only debts keep these columns.
const SCHEDULE_TABLES = [DEBT_DETAILS];
const PROVIDER_SCHEDULE_COLUMNS = [
  'expected_amount',
  'charge_frequency',
  'due_day',
  'due_month',
  'bills_from',
  'show_in_calendar',
  'paying_account_id',
];

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
  return ds.query(`INSERT INTO ${PROVIDER_EXPENSE_DETAILS} (account_id, provider_tax_id) VALUES (?, '12.345.678/0001-90')`, [
    accountId,
  ]);
}

async function insertBill(ds: DataSource, providerId: number, payingId: number | null = null): Promise<number> {
  const result: { insertId: number } = await ds.query(
    `INSERT INTO ${BILLS} (provider_account_id, paying_account_id, due_date, expected_amount, description) VALUES (?, ?, '2026-03-10', 5000, 'Tax')`,
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
    });

    it.each(PROVIDER_SCHEDULE_COLUMNS)('no longer has the provider-level schedule column %s', async (column) => {
      expect(await columnInfo(ds, PROVIDER_EXPENSE_DETAILS, column)).toBeUndefined();
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

  describe('bank_provider_bills', () => {
    it('creates the columns and the (provider_account_id, due_date) index', async () => {
      expect(await columnInfo(ds, BILLS, 'provider_account_id')).toMatchObject({ type: 'int', nullable: false });
      expect(await columnInfo(ds, BILLS, 'paying_account_id')).toMatchObject({ type: 'int', nullable: true });
      expect(await columnInfo(ds, BILLS, 'due_date')).toMatchObject({ type: 'date', nullable: true });
      expect(await columnInfo(ds, BILLS, 'expected_amount')).toMatchObject({ type: 'bigint', nullable: true });
      expect(await columnInfo(ds, BILLS, 'kind')).toMatchObject({ type: 'varchar(16)', nullable: false });
      for (const column of ['charge_frequency', 'due_day', 'due_month', 'bills_from', 'show_in_calendar']) {
        expect(await columnInfo(ds, BILLS, column)).toMatchObject({ nullable: true });
      }
      expect(await indexColumns(ds, BILLS, 'uq_bank_provider_bills_recurring_description')).toEqual([
        'provider_account_id',
        'recurring_description',
      ]);
      expect(await indexColumns(ds, BILLS, 'idx_bank_provider_bills_provider_kind_description')).toEqual([
        'provider_account_id',
        'kind',
        'description',
      ]);
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

    it('rejects a duplicate recurring description, but allows duplicate one-offs and a one-off sharing it', async () => {
      const provider = await insertAccount(ds, { userId: 1 }, 'Provider');
      const recurring = (description: string) =>
        ds.query(`INSERT INTO ${BILLS} (provider_account_id, kind, description, due_day) VALUES (?, 'recurring', ?, 5)`, [provider, description]);
      await recurring('Rent');

      await expect(recurring('Rent')).rejects.toThrow(/Duplicate entry/);
      await expect(recurring('Other')).resolves.toBeDefined();
      await expect(insertBill(ds, provider)).resolves.toBeGreaterThan(0);
      await expect(insertBill(ds, provider)).resolves.toBeGreaterThan(0);
      await expect(ds.query(`INSERT INTO ${BILLS} (provider_account_id, description) VALUES (?, 'Rent')`, [provider])).resolves.toBeDefined();
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

    it('adds provider_bill_id with an index and a cascade FK, and enforces the provider-bill key', async () => {
      expect(await columnInfo(ds, BILL_PAYMENTS, 'provider_bill_id')).toMatchObject({ type: 'int', nullable: true });
      expect(await indexColumns(ds, BILL_PAYMENTS, 'idx_bank_bill_payments_provider_bill')).toEqual(['provider_bill_id']);
      expect(await indexColumns(ds, BILL_PAYMENTS, 'uq_bank_bill_payments_provider_bill')).toEqual([
        'provider_bill_id',
        'provider_bill_due_date',
      ]);
      const provider = await insertAccount(ds, { userId: 1 }, 'Provider');
      const bill = await insertBill(ds, provider);
      await insertPayment(ds, { source_account_id: provider, provider_bill_id: bill });

      await expect(insertPayment(ds, { source_account_id: provider, provider_bill_id: bill })).rejects.toThrow(/Duplicate entry/);
      await expect(insertPayment(ds, { source_account_id: provider, provider_bill_id: bill, due_date: '2026-04-10' })).resolves.toBeGreaterThan(0);
      await expect(insertPayment(ds, { source_account_id: provider, provider_bill_id: 999999 })).rejects.toThrow(/foreign key constraint fails/);
    });

    it('narrows the debt key: provider-bill rows do not collide with an id-less row, and cascade with their bill', async () => {
      const provider = await insertAccount(ds, { userId: 1 }, 'Provider');
      const bill = await insertBill(ds, provider);
      await insertPayment(ds, { source_account_id: provider });
      await expect(insertPayment(ds, { source_account_id: provider, provider_bill_id: bill })).resolves.toBeGreaterThan(0);
      await expect(insertPayment(ds, { source_account_id: provider })).rejects.toThrow(/Duplicate entry/);

      await ds.query(`DELETE FROM ${BILLS} WHERE id = ?`, [bill]);

      expect(await ds.query(`SELECT provider_bill_id AS pb FROM ${BILL_PAYMENTS}`)).toEqual([{ pb: null }]);
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

  describe('expand provider bills', () => {
    const PROVIDER_COLUMNS = '(user_id, type, name, currency, opening_date, archived_at)';

    async function seedProvider(
      name: string,
      details: Record<string, unknown> = {},
      archived = false,
      type = 'provider_expense',
    ): Promise<number> {
      const account: { insertId: number } = await ds.query(
        `INSERT INTO ${ACCOUNTS} ${PROVIDER_COLUMNS} VALUES (1, ?, ?, 'BRL', '2026-01-01', ?)`,
        [type, name, archived ? new Date() : null],
      );
      const row = { account_id: account.insertId, ...details };
      const table = type === 'provider_expense' ? PROVIDER_EXPENSE_DETAILS : DEBT_DETAILS;
      await ds.query(
        `INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`,
        Object.values(row),
      );
      return account.insertId;
    }

    const seedPayment = (source: number, dueDate: string): Promise<unknown> =>
      ds.query(`INSERT INTO ${BILL_PAYMENTS} (source_account_id, bill_id, due_date, status) VALUES (?, NULL, ?, 'skipped')`, [source, dueDate]);

    const recurringBills = (): Promise<Array<Record<string, unknown>>> =>
      ds.query(
        `SELECT provider_account_id AS provider, description, kind, expected_amount AS expected, charge_frequency AS frequency,
                due_day AS dueDay, due_month AS dueMonth, DATE_FORMAT(bills_from, '%Y-%m-%d') AS billsFrom,
                show_in_calendar AS shown, due_date AS dueDate
           FROM ${BILLS} WHERE kind = 'recurring' ORDER BY provider_account_id`,
      );

    beforeEach(async () => {
      await resetDatabase(ds);
      await runMigrationsUpTo(ds, 'AuthAddUsersLocale20261113120024');
    });

    describe('backfill', () => {
      it('creates one recurring bill per scheduled provider, archived included, with copied fields', async () => {
        const active = await seedProvider('Rent', { due_day: 5, expected_amount: 20000, charge_frequency: 'yearly', due_month: 3, bills_from: '2026-01-01' });
        const archived = await seedProvider('Old', { due_day: 9, show_in_calendar: 0 }, true);

        await ds.runMigrations();

        expect(await recurringBills()).toEqual([
          { provider: active, description: 'Rent', kind: 'recurring', expected: '20000', frequency: 'yearly', dueDay: 5, dueMonth: 3, billsFrom: '2026-01-01', shown: 1, dueDate: null },
          { provider: archived, description: 'Old', kind: 'recurring', expected: null, frequency: 'monthly', dueDay: 9, dueMonth: null, billsFrom: null, shown: 0, dueDate: null },
        ]);
      });

      it('skips an unscheduled provider without payments and hides one that has payments', async () => {
        await seedProvider('Nothing', {});
        const hidden = await seedProvider('Fee', { charge_frequency: 'yearly' });
        const monthly = await seedProvider('Tax', {});
        await seedPayment(hidden, '2026-02-07');
        await seedPayment(hidden, '2026-05-20');
        await seedPayment(monthly, '2026-03-15');

        await ds.runMigrations();

        expect(await recurringBills()).toEqual([
          { provider: hidden, description: 'Fee', kind: 'recurring', expected: null, frequency: 'yearly', dueDay: 20, dueMonth: 5, billsFrom: '2026-02-07', shown: 0, dueDate: null },
          { provider: monthly, description: 'Tax', kind: 'recurring', expected: null, frequency: 'monthly', dueDay: 15, dueMonth: null, billsFrom: '2026-03-15', shown: 0, dueDate: null },
        ]);
      });

      it('repoints provider payments (off-schedule too), keeps bill_id NULL, and leaves debt payments alone', async () => {
        const provider = await seedProvider('Rent', { due_day: 5 });
        const debt = await seedProvider('Loan', { due_day: 10 }, false, 'debt');
        await seedPayment(provider, '2026-01-05');
        await seedPayment(provider, '2026-01-17');
        await seedPayment(debt, '2026-01-10');

        await ds.runMigrations();

        const [{ id: billId }]: Array<{ id: number }> = await ds.query(`SELECT id FROM ${BILLS} WHERE provider_account_id = ?`, [provider]);
        expect(await ds.query(`SELECT source_account_id AS source, bill_id AS bill, provider_bill_id AS pb FROM ${BILL_PAYMENTS} ORDER BY id`)).toEqual([
          { source: provider, bill: null, pb: billId },
          { source: provider, bill: null, pb: billId },
          { source: debt, bill: null, pb: null },
        ]);
      });

      it('migrates one-offs unchanged, duplicates and ids included', async () => {
        const provider = await seedProvider('Rent', { due_day: 5 });
        for (const id of [3, 4]) {
          await ds.query(`INSERT INTO ${OLD_BILLS} (id, provider_account_id, due_date, amount, description) VALUES (?, ?, '2026-03-10', 5000, 'Tax')`, [id, provider]);
        }

        await ds.runMigrations();

        expect(await ds.query(`SELECT id, kind, expected_amount AS amount, description FROM ${BILLS} WHERE kind = 'one_off' ORDER BY id`)).toEqual([
          { id: 3, kind: 'one_off', amount: '5000', description: 'Tax' },
          { id: 4, kind: 'one_off', amount: '5000', description: 'Tax' },
        ]);
      });
    });

    describe('pre-flight', () => {
      it('rejects duplicate provider payments with ids and dates only, leaving the schema untouched', async () => {
        const provider = await seedProvider('Secret name', { due_day: 5 });
        await ds.query(`ALTER TABLE ${BILL_PAYMENTS} DROP INDEX uq_bank_bill_payments_derived`);
        await seedPayment(provider, '2026-01-05');
        await seedPayment(provider, '2026-01-05');

        const error = await ds.runMigrations().catch((e: Error) => e);

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(`${provider}:2026-01-05`);
        expect((error as Error).message).not.toContain('Secret name');
        expect(await tableNames(ds)).toContain(OLD_BILLS);
        expect(await tableNames(ds)).not.toContain(BILLS);
        expect(await columnInfo(ds, OLD_BILLS, 'kind')).toBeUndefined();
      });
    });

    describe('down', () => {
      it('restores the original columns, keys and one-offs, dropping the recurring rows', async () => {
        const provider = await seedProvider('Rent', { due_day: 5 });
        await ds.query(`INSERT INTO ${OLD_BILLS} (id, provider_account_id, due_date, amount, description) VALUES (3, ?, '2026-03-10', 5000, 'Tax')`, [provider]);
        await seedPayment(provider, '2026-01-05');
        await ds.runMigrations();

        await ds.undoLastMigration();
        await ds.undoLastMigration();
        await ds.undoLastMigration();

        expect(await tableNames(ds)).toContain(OLD_BILLS);
        expect(await tableNames(ds)).not.toContain(BILLS);
        expect(await columnInfo(ds, OLD_BILLS, 'amount')).toMatchObject({ type: 'bigint', nullable: false });
        expect(await columnInfo(ds, OLD_BILLS, 'due_date')).toMatchObject({ nullable: false });
        expect(await columnInfo(ds, OLD_BILLS, 'kind')).toBeUndefined();
        expect(await columnInfo(ds, BILL_PAYMENTS, 'provider_bill_id')).toBeUndefined();
        expect(await columnInfo(ds, BILL_PAYMENTS, 'provider_bill_due_date')).toBeUndefined();
        expect(await indexColumns(ds, BILL_PAYMENTS, 'uq_bank_bill_payments_derived')).toEqual(['source_account_id', 'derived_due_date']);
        expect(await ds.query(`SELECT id, amount FROM ${OLD_BILLS}`)).toEqual([{ id: 3, amount: '5000' }]);
        await expect(seedPayment(provider, '2026-01-05')).rejects.toThrow(/Duplicate entry/);
      });

      it('restores a partially applied up', async () => {
        const provider = await seedProvider('Rent', { due_day: 5 });
        await ds.query(`INSERT INTO ${OLD_BILLS} (id, provider_account_id, due_date, amount, description) VALUES (3, ?, '2026-03-10', 5000, 'Tax')`, [provider]);
        await ds.query(`RENAME TABLE ${OLD_BILLS} TO ${BILLS}`);
        await ds.query(ALTER_BILLS_SQL);

        const runner = ds.createQueryRunner();
        try {
          await new BankExpandProviderBills20261117120025().down(runner);
        } finally {
          await runner.release();
        }

        expect(await tableNames(ds)).toContain(OLD_BILLS);
        expect(await tableNames(ds)).not.toContain(BILLS);
        expect(await columnInfo(ds, OLD_BILLS, 'amount')).toMatchObject({ nullable: false });
        expect(await columnInfo(ds, OLD_BILLS, 'kind')).toBeUndefined();
        expect(await columnInfo(ds, BILL_PAYMENTS, 'derived_due_date')).toBeDefined();
      });
    });
  });

  describe('contract provider bills', () => {
    async function seedProvider(name: string): Promise<number> {
      const accountId = await insertAccount(ds, { userId: 1 }, name);
      await ds.query(`INSERT INTO ${PROVIDER_EXPENSE_DETAILS} (account_id) VALUES (?)`, [accountId]);
      return accountId;
    }

    function seedRecurring(provider: number, description: string, fields: Record<string, unknown> = {}): Promise<unknown> {
      const row = { provider_account_id: provider, kind: 'recurring', description, due_day: 5, ...fields };
      const columns = Object.keys(row);
      return ds.query(
        `INSERT INTO ${BILLS} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        Object.values(row),
      );
    }

    const schedules = (): Promise<Array<Record<string, unknown>>> =>
      ds.query(
        `SELECT account_id AS id, expected_amount AS expected, charge_frequency AS frequency, due_day AS dueDay,
                due_month AS dueMonth, DATE_FORMAT(bills_from, '%Y-%m-%d') AS billsFrom, show_in_calendar AS shown,
                paying_account_id AS paying
           FROM ${PROVIDER_EXPENSE_DETAILS} ORDER BY account_id`,
      );

    async function runDown(): Promise<void> {
      const runner = ds.createQueryRunner();
      try {
        await new BankContractProviderBills20261120120026().down(runner);
      } finally {
        await runner.release();
      }
    }

    it('down backfills only from a single recurring bill (one-offs ignored), NULL for zero or several, and re-runs safely', async () => {
      const paying = await insertAccount(ds, { userId: 1 }, 'Checking');
      const single = await seedProvider('Single');
      const none = await seedProvider('None');
      const several = await seedProvider('Several');
      await seedRecurring(single, 'Rent', {
        expected_amount: 20000,
        charge_frequency: 'yearly',
        due_day: 7,
        due_month: 3,
        bills_from: '2026-02-01',
        show_in_calendar: 0,
        paying_account_id: paying,
      });
      await insertBill(ds, single);
      await insertBill(ds, none);
      await seedRecurring(several, 'Rent', { expected_amount: 100 });
      await seedRecurring(several, 'Fee', { expected_amount: 200 });

      await ds.undoLastMigration();
      await runDown();

      const empty = { expected: null, frequency: 'monthly', dueDay: null, dueMonth: null, billsFrom: null, shown: 1, paying: null };
      expect(await schedules()).toEqual([
        { id: single, expected: '20000', frequency: 'yearly', dueDay: 7, dueMonth: 3, billsFrom: '2026-02-01', shown: 0, paying },
        { id: none, ...empty },
        { id: several, ...empty },
      ]);
    });

    it('down falls back to the column defaults for a recurring bill with NULL frequency and visibility', async () => {
      const provider = await seedProvider('Nullish');
      await seedRecurring(provider, 'Rent', { charge_frequency: null, show_in_calendar: null });

      await ds.undoLastMigration();

      expect(await schedules()).toEqual([
        { id: provider, expected: null, frequency: 'monthly', dueDay: 5, dueMonth: null, billsFrom: null, shown: 1, paying: null },
      ]);
    });

    it('up leaves the payment count unchanged', async () => {
      await resetDatabase(ds);
      await runMigrationsUpTo(ds, 'BankExpandProviderBills20261117120025');
      const provider = await seedProvider('Rent');
      await seedRecurring(provider, 'Rent');
      const [{ id: billId }]: Array<{ id: number }> = await ds.query(`SELECT id FROM ${BILLS}`);
      await insertPayment(ds, { source_account_id: provider, provider_bill_id: billId });
      await insertPayment(ds, { source_account_id: provider, provider_bill_id: billId, due_date: '2026-04-10' });
      const count = async (): Promise<unknown> => (await ds.query(`SELECT COUNT(*) AS n FROM ${BILL_PAYMENTS}`))[0].n;
      const before = await count();

      await ds.runMigrations();

      expect(await count()).toEqual(before);
      expect(await columnInfo(ds, PROVIDER_EXPENSE_DETAILS, 'expected_amount')).toBeUndefined();
    });
  });

  describe('down', () => {
    it('restores the provider schedule, drops the bill tables, then the schedule fields, then sent_to_accountant_at, then bank_provider_expense_details, bank_investment_details, bank_debt_details, then bank_transactions, then bank_accounts', async () => {
      // First undo the provider-bills contract (re-adds the provider schedule columns), then the
      // provider-bills expand (back to bank_bills), then the later, non-bank auth locale migration.
      await ds.undoLastMigration();
      for (const column of PROVIDER_SCHEDULE_COLUMNS) {
        expect(await columnInfo(ds, PROVIDER_EXPENSE_DETAILS, column)).toBeDefined();
      }
      await ds.undoLastMigration();
      await ds.undoLastMigration();
      expect(await tableNames(ds)).toContain(OLD_BILLS);
      expect(await tableNames(ds)).not.toContain(BILLS);
      await ds.undoLastMigration();
      expect(await tableNames(ds)).not.toContain(BILL_PAYMENTS);
      expect(await tableNames(ds)).not.toContain(OLD_BILLS);
      expect(await columnInfo(ds, DEBT_DETAILS, 'bills_from')).toBeDefined();

      await ds.undoLastMigration();
      for (const table of [DEBT_DETAILS, PROVIDER_EXPENSE_DETAILS]) {
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
