import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from './test-data-source.js';
import { ownerColumns } from '../../../bank/account-fields.js';
import { Account } from '../../../bank/entities/account.entity.js';
import { BillPayment } from '../../../bank/entities/bill-payment.entity.js';
import { Transaction } from '../../../bank/entities/transaction.entity.js';
import { PaymentGeneratedQuery } from '../../../bank/payment-generated.query.js';
import type { OwnerScope } from '../../../core/owner-context.js';

const ALICE: OwnerScope = { kind: 'user', userId: 1 };
const ALICE_ORG: OwnerScope = { kind: 'organization', organizationId: 1 };
const BOB_ORG: OwnerScope = { kind: 'organization', organizationId: 2 };
const REFS = ['paymentTransactionId', 'withdrawalTransactionId', 'chargeTransactionId'] as const;

describe('payment-generated transaction lookup (MySQL)', () => {
  let ds: DataSource;
  let accounts: Repository<Account>;
  let payments: Repository<BillPayment>;
  let transactions: Repository<Transaction>;
  let query: PaymentGeneratedQuery;
  let dueDay = 1;

  async function insertAccount(owner: OwnerScope): Promise<number> {
    const account = await accounts.save(accounts.create({
      ...ownerColumns(owner),
      type: 'regular',
      name: `Account ${Math.random()}`,
      currency: 'BRL',
      openingDate: '2026-01-01',
      openingBalance: 0n,
      archivedAt: null,
    }));
    return account.id;
  }

  async function insertTransaction(accountId: number): Promise<number> {
    const saved = await transactions.save(transactions.create({
      accountId, date: '2026-01-12', amount: -1n, description: 'T', sentToAccountantAt: null,
    }));
    return saved.id;
  }

  async function insertPayment(sourceAccountId: number, refs: Partial<Record<(typeof REFS)[number], number>>): Promise<void> {
    await payments.save(payments.create({
      sourceAccountId,
      billId: null,
      providerBillId: null,
      dueDate: `2026-01-${String(dueDay++).padStart(2, '0')}`,
      status: 'paid',
      paidOn: '2026-01-12',
      amount: 1n,
      payingAccountId: null,
      paymentTransactionId: null,
      withdrawalTransactionId: null,
      chargeTransactionId: null,
      ...refs,
    }));
  }

  beforeAll(async () => {
    ds = await createTestDataSource();
    accounts = ds.getRepository(Account);
    payments = ds.getRepository(BillPayment);
    transactions = ds.getRepository(Transaction);
    query = new PaymentGeneratedQuery(payments);
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await ds.runMigrations();
    dueDay = 1;
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it.each(REFS)('finds a transaction referenced by %s of a payment of the same owner', async (ref) => {
    const source = await insertAccount(ALICE_ORG);
    const transaction = await insertTransaction(await insertAccount(ALICE_ORG));
    await insertPayment(source, { [ref]: transaction });

    await expect(query.isPaymentGenerated(ALICE_ORG, transaction)).resolves.toBe(true);
  });

  it('ignores a payment whose source account belongs to another owner or context', async () => {
    const transaction = await insertTransaction(await insertAccount(ALICE_ORG));
    await insertPayment(await insertAccount(BOB_ORG), { paymentTransactionId: transaction });
    await insertPayment(await insertAccount(ALICE), { chargeTransactionId: transaction });

    await expect(query.isPaymentGenerated(ALICE_ORG, transaction)).resolves.toBe(false);
    await expect(query.isPaymentGenerated(ALICE, transaction)).resolves.toBe(true);
  });

  it('answers false for a plain transaction', async () => {
    const account = await insertAccount(ALICE);
    const transaction = await insertTransaction(account);
    await insertPayment(account, { paymentTransactionId: await insertTransaction(account) });

    await expect(query.isPaymentGenerated(ALICE, transaction)).resolves.toBe(false);
  });
});
