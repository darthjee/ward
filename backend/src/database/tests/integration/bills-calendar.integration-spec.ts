import { Between, LessThan, type DataSource, type Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from './test-data-source.js';
import { AccountTypeRegistry } from '../../../bank/account-types/account-type.registry.js';
import { DebtAccountHandler } from '../../../bank/account-types/debt-account.handler.js';
import { ProviderExpenseAccountHandler } from '../../../bank/account-types/provider-expense-account.handler.js';
import { RegularAccountHandler } from '../../../bank/account-types/regular-account.handler.js';
import { CalendarQuery } from '../../../bank/calendar.query.js';
import { CalendarService } from '../../../bank/calendar.service.js';
import { Account } from '../../../bank/entities/account.entity.js';
import { BillPayment } from '../../../bank/entities/bill-payment.entity.js';
import { Bill } from '../../../bank/entities/bill.entity.js';
import { DebtDetails } from '../../../bank/entities/debt-details.entity.js';
import { ProviderExpenseDetails } from '../../../bank/entities/provider-expense-details.entity.js';

const ALICE = { kind: 'user', userId: 1 } as const;

describe('bills calendar reads (MySQL)', () => {
  let ds: DataSource;
  let accounts: Repository<Account>;
  let bills: Repository<Bill>;
  let payments: Repository<BillPayment>;
  let query: CalendarQuery;
  let service: CalendarService;

  async function insertAccount(fields: Partial<Account> = {}): Promise<Account> {
    return accounts.save(accounts.create({
      userId: 1,
      organizationId: null,
      type: 'regular',
      name: `Account ${Math.random()}`,
      currency: 'BRL',
      openingDate: '2026-01-01',
      openingBalance: 0n,
      archivedAt: null,
      ...fields,
    }));
  }

  beforeAll(async () => {
    ds = await createTestDataSource();
    accounts = ds.getRepository(Account);
    bills = ds.getRepository(Bill);
    payments = ds.getRepository(BillPayment);
    const registry = new AccountTypeRegistry([
      new RegularAccountHandler(),
      new DebtAccountHandler(),
      new ProviderExpenseAccountHandler(),
    ]);
    query = new CalendarQuery(accounts, bills, payments, registry);
    service = new CalendarService(query);
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('reads the owner\'s scheduled sources with their default paying account, skipping archived and hidden ones', async () => {
    const paying = await insertAccount({ name: 'Checking' });
    const loan = await insertAccount({ type: 'debt', name: 'Loan' });
    const hidden = await insertAccount({ type: 'debt' });
    const archived = await insertAccount({ type: 'debt', archivedAt: new Date() });
    const other = await insertAccount({ type: 'debt', userId: 2 });
    const details = ds.getRepository(DebtDetails);
    for (const [account, shown] of [[loan, true], [hidden, false], [archived, true], [other, true]] as const) {
      await details.save({
        accountId: account.id,
        dueDay: 10,
        billsFrom: '2026-01-01',
        showInCalendar: shown,
        payingAccountId: account === loan ? paying.id : null,
        instalmentAmount: 50000n,
      });
    }

    const { scheduled } = await query.sources(ALICE);

    expect(scheduled.map(({ account }) => account.id)).toEqual([loan.id]);
    expect(scheduled[0]).toMatchObject({
      expected: 50000n,
      defaultPayingAccount: { id: paying.id, name: 'Checking' },
      schedule: { billsFrom: '2026-01-01', dueDay: 10, showInCalendar: true },
    });
  });

  it('filters bills and payments by date range with real operators', async () => {
    const provider = await insertAccount({ type: 'provider_expense' });
    await ds.getRepository(ProviderExpenseDetails).save({ accountId: provider.id, dueDay: 5, billsFrom: '2026-01-01' });
    const inRange = await bills.save(bills.create({ providerAccountId: provider.id, payingAccountId: null, dueDate: '2026-01-20', amount: 100n, description: 'In', notes: null }));
    await bills.save(bills.create({ providerAccountId: provider.id, payingAccountId: null, dueDate: '2026-02-20', amount: 100n, description: 'Out', notes: null }));
    const derived = await payments.save(payments.create({ sourceAccountId: provider.id, billId: null, dueDate: '2026-01-05', status: 'skipped', paidOn: null, amount: null, payingAccountId: null, paymentTransactionId: null, withdrawalTransactionId: null, chargeTransactionId: null }));
    const oneOff = await payments.save(payments.create({ sourceAccountId: provider.id, billId: inRange.id, dueDate: '2026-01-20', status: 'skipped', paidOn: null, amount: null, payingAccountId: null, paymentTransactionId: null, withdrawalTransactionId: null, chargeTransactionId: null }));

    expect((await query.bills([provider.id], Between('2026-01-01', '2026-01-31'))).map(({ id }) => id)).toEqual([inRange.id]);
    expect((await query.bills([provider.id], LessThan('2026-02-01'))).map(({ id }) => id)).toEqual([inRange.id]);
    expect((await query.payments([provider.id], [inRange.id], Between('2026-01-01', '2026-01-31'))).map(({ id }) => id).sort())
      .toEqual([derived.id, oneOff.id].sort());
    expect((await query.payments([provider.id], [], Between('2026-02-01', '2026-02-28')))).toEqual([]);

    const calendar = await service.calendar(ALICE, { from: '2026-01-01', to: '2026-01-31' });
    expect(calendar.occurrences.map(({ kind, status, nominal_date: nominal }) => [kind, status, nominal])).toEqual([
      ['provider', 'skipped', '2026-01-05'],
      ['bill', 'skipped', '2026-01-20'],
    ]);
  });
});
