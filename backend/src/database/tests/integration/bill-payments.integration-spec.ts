import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from './test-data-source.js';
import { BillPaymentWriter } from '../../../bank/bill-payment.writer.js';
import { Account } from '../../../bank/entities/account.entity.js';
import { BillPayment } from '../../../bank/entities/bill-payment.entity.js';
import { Transaction } from '../../../bank/entities/transaction.entity.js';

const PAID = { status: 'paid', paidOn: '2026-01-12', amount: 1000n, payingAccountId: 0, recordCharge: true } as const;

describe('bill payment writes (MySQL)', () => {
  let ds: DataSource;
  let accounts: Repository<Account>;
  let payments: Repository<BillPayment>;
  let transactions: Repository<Transaction>;

  async function insertAccount(type: string): Promise<Account> {
    return accounts.save(accounts.create({
      userId: 1,
      organizationId: null,
      type,
      name: `Account ${Math.random()}`,
      currency: 'BRL',
      openingDate: '2026-01-01',
      openingBalance: 0n,
      archivedAt: null,
    }));
  }

  beforeAll(async () => {
    ds = await createTestDataSource();
    accounts = ds.getRepository(Account);
    payments = ds.getRepository(BillPayment);
    transactions = ds.getRepository(Transaction);
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('writes the row and its transactions, and undo removes them', async () => {
    const provider = await insertAccount('provider_expense');
    const paying = await insertAccount('regular');
    const writer = new BillPaymentWriter(payments);
    const target = { sourceAccountId: provider.id, billId: null, nominal: '2026-01-05', label: 'Fee' };

    const row = await writer.record(target, { ...PAID, payingAccountId: paying.id });

    expect(await transactions.count()).toBe(3);
    expect((await payments.findOneByOrFail({ id: row.id })).dueDate).toBe('2026-01-05');
    await writer.remove(row);
    expect(await transactions.count()).toBe(0);
    expect(await payments.count()).toBe(0);
  });

  it('rolls the transactions back when the payment row hits the unique key (race past the pre-check)', async () => {
    const provider = await insertAccount('provider_expense');
    const paying = await insertAccount('regular');
    await payments.save(payments.create({
      sourceAccountId: provider.id,
      billId: null,
      dueDate: '2026-01-05',
      status: 'skipped',
      paidOn: null,
      amount: null,
      payingAccountId: null,
      paymentTransactionId: null,
      withdrawalTransactionId: null,
      chargeTransactionId: null,
    }));
    // A repository whose pre-check misses the existing row, as in a concurrent request.
    const racing = Object.assign(Object.create(payments) as Repository<BillPayment>, { findOneBy: async () => null });
    const writer = new BillPaymentWriter(racing);

    await expect(writer.record(
      { sourceAccountId: provider.id, billId: null, nominal: '2026-01-05', label: 'Fee' },
      { ...PAID, payingAccountId: paying.id },
    )).rejects.toMatchObject({ status: 409 });

    expect(await transactions.count()).toBe(0);
    expect(await payments.count()).toBe(1);
  });
});
