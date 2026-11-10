import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from './test-data-source.js';
import { BillPaymentWriter } from '../../../bank/bill-payment.writer.js';
import { BillService } from '../../../bank/bill.service.js';
import { Account } from '../../../bank/entities/account.entity.js';
import { BillPayment } from '../../../bank/entities/bill-payment.entity.js';
import { Bill } from '../../../bank/entities/bill.entity.js';
import { Transaction } from '../../../bank/entities/transaction.entity.js';
import { PayingAccountResolver } from '../../../bank/paying-account.resolver.js';

const PAID = { status: 'paid', paidOn: '2026-01-12', amount: 1000n, payingAccountId: 0, recordCharge: true } as const;
const ALICE = { kind: 'user', userId: 1 } as const;
const settle = (ms = 300): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('bill payment writes (MySQL)', () => {
  let ds: DataSource;
  let accounts: Repository<Account>;
  let payments: Repository<BillPayment>;
  let transactions: Repository<Transaction>;
  let bills: Repository<Bill>;
  let writer: BillPaymentWriter;

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
    bills = ds.getRepository(Bill);
    writer = new BillPaymentWriter(payments, new PayingAccountResolver(accounts));
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
    const target = { sourceAccountId: provider.id, billId: null, nominal: '2026-01-05', label: 'Fee', currency: 'BRL' };

    const row = await writer.record(ALICE, target, { ...PAID, payingAccountId: paying.id });

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
    const racingWriter = new BillPaymentWriter(racing, new PayingAccountResolver(accounts));

    await expect(racingWriter.record(
      ALICE,
      { sourceAccountId: provider.id, billId: null, nominal: '2026-01-05', label: 'Fee', currency: 'BRL' },
      { ...PAID, payingAccountId: paying.id },
    )).rejects.toMatchObject({ status: 409 });

    expect(await transactions.count()).toBe(0);
    expect(await payments.count()).toBe(1);
  });

  describe('races past the pre-checks (row locks)', () => {
    async function insertBill(providerId: number, payingId: number): Promise<Bill> {
      return bills.save(bills.create({
        providerAccountId: providerId,
        payingAccountId: payingId,
        dueDate: '2026-01-20',
        amount: 1000n,
        description: 'IPVA',
        notes: null,
      }));
    }

    const oneOff = (bill: Bill) =>
      ({ sourceAccountId: bill.providerAccountId, billId: bill.id, nominal: bill.dueDate, label: bill.description, currency: 'BRL' });

    it('re-validates the paying account inside the transaction: archived meanwhile → 422, nothing written', async () => {
      const provider = await insertAccount('provider_expense');
      const paying = await insertAccount('regular');
      await accounts.update({ id: paying.id }, { archivedAt: new Date() });

      await expect(writer.record(
        ALICE,
        { sourceAccountId: provider.id, billId: null, nominal: '2026-01-05', label: 'Fee', currency: 'BRL' },
        { ...PAID, payingAccountId: paying.id },
      )).rejects.toMatchObject({ status: 422 });

      expect(await transactions.count()).toBe(0);
      expect(await payments.count()).toBe(0);
    });

    it('waits on a bill locked by a concurrent delete, then answers 404 instead of an FK error', async () => {
      const provider = await insertAccount('provider_expense');
      const paying = await insertAccount('regular');
      const bill = await insertBill(provider.id, paying.id);
      const runner = ds.createQueryRunner();
      await runner.startTransaction();
      await runner.manager.getRepository(Bill).findOne({ where: { id: bill.id }, lock: { mode: 'pessimistic_write' } });

      const paid = writer.record(ALICE, oneOff(bill), { ...PAID, payingAccountId: paying.id });
      const outcome = paid.then(() => 'written', (error: { status?: number }) => error.status);
      await settle();
      await runner.manager.getRepository(Bill).delete({ id: bill.id });
      await runner.commitTransaction();
      await runner.release();

      expect(await outcome).toBe(404);
      expect(await transactions.count()).toBe(0);
      expect(await payments.count()).toBe(0);
    });

    it('makes a delete wait for a concurrent pay of the bill, then answer 409 keeping the payment', async () => {
      const provider = await insertAccount('provider_expense');
      const paying = await insertAccount('regular');
      const bill = await insertBill(provider.id, paying.id);
      const service = new BillService(bills, accounts, payments, new PayingAccountResolver(accounts));
      const runner = ds.createQueryRunner();
      await runner.startTransaction();
      await runner.manager.getRepository(Bill).findOne({ where: { id: bill.id }, lock: { mode: 'pessimistic_write' } });

      const outcome = service.delete(ALICE, bill.id).then(() => 'deleted', (error: { status?: number }) => error.status);
      await settle();
      await runner.manager.getRepository(BillPayment).save(runner.manager.getRepository(BillPayment).create({
        sourceAccountId: provider.id,
        billId: bill.id,
        dueDate: bill.dueDate,
        status: 'paid',
        paidOn: '2026-01-12',
        amount: 1000n,
        payingAccountId: paying.id,
        paymentTransactionId: null,
        withdrawalTransactionId: null,
        chargeTransactionId: null,
      }));
      await runner.commitTransaction();
      await runner.release();

      expect(await outcome).toBe(409);
      expect(await bills.count()).toBe(1);
      expect(await payments.count()).toBe(1);
    });
  });
});
