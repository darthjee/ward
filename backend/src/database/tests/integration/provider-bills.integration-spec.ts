import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from './test-data-source.js';
import type { CreateProviderBillDto } from '../../../bank/dto/create-provider-bill.dto.js';
import { Account } from '../../../bank/entities/account.entity.js';
import { BillPayment } from '../../../bank/entities/bill-payment.entity.js';
import { ProviderBill } from '../../../bank/entities/provider-bill.entity.js';
import { PayingAccountResolver } from '../../../bank/paying-account.resolver.js';
import { PROVIDER_BILL_RECURRING_LIMIT } from '../../../bank/provider-bill-conflicts.js';
import { ProviderBillResolver } from '../../../bank/provider-bill.resolver.js';
import { ProviderBillService } from '../../../bank/provider-bill.service.js';

const ALICE = { kind: 'user', userId: 1 } as const;
const recurring = (description: string): CreateProviderBillDto => ({ kind: 'recurring', description, due_day: 5 });
const outcomes = async (...runs: Array<Promise<unknown>>) => Promise.allSettled(runs);
const codeOf = (result: PromiseSettledResult<unknown>): unknown =>
  result.status === 'rejected' ? (result.reason as { response?: { code?: string } }).response?.code ?? result.reason : undefined;

describe('provider bills (MySQL)', () => {
  let ds: DataSource;
  let accounts: Repository<Account>;
  let bills: Repository<ProviderBill>;
  let payments: Repository<BillPayment>;
  let service: ProviderBillService;
  let provider: Account;

  beforeAll(async () => {
    ds = await createTestDataSource();
    accounts = ds.getRepository(Account);
    bills = ds.getRepository(ProviderBill);
    payments = ds.getRepository(BillPayment);
    service = new ProviderBillService(bills, new ProviderBillResolver(bills, accounts), new PayingAccountResolver(accounts));
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await ds.runMigrations();
    provider = await accounts.save(accounts.create({
      userId: 1,
      organizationId: null,
      type: 'provider_expense',
      name: 'Provider',
      currency: 'BRL',
      openingDate: '2026-01-01',
      openingBalance: 0n,
      archivedAt: null,
    }));
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('lets exactly one of two concurrent creates take the last recurring slot', async () => {
    for (let i = 0; i < PROVIDER_BILL_RECURRING_LIMIT - 1; i += 1) {
      await service.create(ALICE, provider.id, recurring(`bill ${i}`));
    }

    const results = await outcomes(
      service.create(ALICE, provider.id, recurring('last A')),
      service.create(ALICE, provider.id, recurring('last B')),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.map(codeOf).filter(Boolean)).toEqual(['PROVIDER_BILL_LIMIT']);
    expect(await bills.countBy({ providerAccountId: provider.id, kind: 'recurring' })).toBe(PROVIDER_BILL_RECURRING_LIMIT);
  }, 60_000);

  it('answers NAME_TAKEN (never a 500) to concurrent creates differing only by case or accents', async () => {
    const results = await outcomes(
      service.create(ALICE, provider.id, recurring('Água')),
      service.create(ALICE, provider.id, recurring('agua')),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.map(codeOf).filter(Boolean)).toEqual(['PROVIDER_BILL_NAME_TAKEN']);
  });

  it('enforces the accent- and case-insensitive unique key itself, but not between one-offs', async () => {
    await bills.save(bills.create({ providerAccountId: provider.id, kind: 'recurring', description: 'Água', dueDay: 5, chargeFrequency: 'monthly', billsFrom: '2026-01-01', showInCalendar: true }));

    await expect(bills.save(bills.create({ providerAccountId: provider.id, kind: 'recurring', description: 'AGUA', dueDay: 5, chargeFrequency: 'monthly', billsFrom: '2026-01-01', showInCalendar: true })))
      .rejects.toMatchObject({ driverError: { code: 'ER_DUP_ENTRY' } });
    await service.create(ALICE, provider.id, { kind: 'one_off', description: 'Água', due_date: '2026-03-10', expected_amount: '1.00' });
    await service.create(ALICE, provider.id, { kind: 'one_off', description: 'Água', due_date: '2026-03-10', expected_amount: '1.00' });
  });

  describe('delete', () => {
    const skipped = (providerBillId: number | null, billId: number | null, status: 'skipped' | 'paid' = 'skipped') =>
      payments.save(payments.create({
        sourceAccountId: provider.id,
        billId,
        providerBillId,
        dueDate: '2026-03-05',
        status,
        paidOn: status === 'paid' ? '2026-03-05' : null,
        amount: status === 'paid' ? 1000n : null,
        payingAccountId: null,
        paymentTransactionId: null,
        withdrawalTransactionId: null,
        chargeTransactionId: null,
      }));

    it('cascades the skipped payment rows of a recurring bill and of a one-off', async () => {
      const rec = await service.create(ALICE, provider.id, recurring('Rent'));
      const single = await service.create(ALICE, provider.id, { kind: 'one_off', description: 'Fine', due_date: '2026-03-05', expected_amount: '1.00' });
      await skipped(rec.id, null);
      await skipped(null, single.id);

      await service.delete(ALICE, rec.id);
      await service.delete(ALICE, single.id);

      expect(await payments.count()).toBe(0);
      expect(await bills.count()).toBe(0);
    });

    it('answers 409 PROVIDER_BILL_PAID and keeps everything when a row is paid', async () => {
      const rec = await service.create(ALICE, provider.id, recurring('Rent'));
      await skipped(rec.id, null);
      await payments.save(payments.create({ ...(await payments.findOneByOrFail({ providerBillId: rec.id })), id: undefined, dueDate: '2026-04-05', status: 'paid', paidOn: '2026-04-05', amount: 1000n }));

      await expect(service.delete(ALICE, rec.id)).rejects.toMatchObject({ response: { code: 'PROVIDER_BILL_PAID' } });

      expect(await bills.count()).toBe(1);
      expect(await payments.count()).toBe(2);
    });
  });
});
