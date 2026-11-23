import type { DataSource } from 'typeorm';
import { columnInfo, tableNames } from './schema-inspection.js';
import { createTestDataSource, MIGRATIONS, resetDatabase } from './test-data-source.js';

describe('migrations round trip (MySQL)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource();
  });

  beforeEach(async () => {
    await resetDatabase(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('runs every migration up, all the way down, and up again', async () => {
    const ran = await ds.runMigrations();
    expect(ran.map(({ name }) => name)).toEqual(MIGRATIONS.map(({ migration }) => migration.name));

    for (let i = 0; i < MIGRATIONS.length; i++) {
      await ds.undoLastMigration();
    }
    expect(await ds.showMigrations()).toBe(true);
    expect((await tableNames(ds)).filter((name) => name.startsWith('auth_'))).toEqual([]);
    expect((await tableNames(ds)).filter((name) => name.startsWith('bank_'))).toEqual([]);

    const rerun = await ds.runMigrations();
    expect(rerun).toHaveLength(MIGRATIONS.length);
    expect(await ds.showMigrations()).toBe(false);
  });

  it('leaves exactly the current auth tables after a full run', async () => {
    await ds.runMigrations();

    expect((await tableNames(ds)).filter((name) => name.startsWith('auth_'))).toEqual([
      'auth_account_edit_lockouts',
      'auth_authorization_requests',
      'auth_organization_memberships',
      'auth_organizations',
      'auth_password_reset_tokens',
      'auth_refresh_tokens',
      'auth_users',
    ]);
  });

  it('leaves exactly the current bank tables after a full run', async () => {
    await ds.runMigrations();

    expect((await tableNames(ds)).filter((name) => name.startsWith('bank_'))).toEqual([
      'bank_accounts',
      'bank_bill_payments',
      'bank_debt_details',
      'bank_investment_details',
      'bank_provider_bills',
      'bank_provider_expense_details',
      'bank_reconciliations',
      'bank_transactions',
    ]);
  });

  it('leaves bank_provider_expense_details without the provider-level schedule after a full up/down/up', async () => {
    await ds.runMigrations();
    for (let i = 0; i < MIGRATIONS.length; i++) {
      await ds.undoLastMigration();
    }
    await ds.runMigrations();

    expect(await columnInfo(ds, 'bank_provider_expense_details', 'for_accountant')).toBeDefined();
    expect(await columnInfo(ds, 'bank_provider_expense_details', 'provider_tax_id')).toBeDefined();
    for (const column of ['expected_amount', 'charge_frequency', 'due_day', 'due_month', 'bills_from', 'show_in_calendar', 'paying_account_id']) {
      expect(await columnInfo(ds, 'bank_provider_expense_details', column)).toBeUndefined();
    }
  });
});
