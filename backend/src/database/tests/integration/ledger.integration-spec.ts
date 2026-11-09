import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from './test-data-source.js';
import { AccountBalancesQuery } from '../../../bank/account-balances.query.js';
import { Account } from '../../../bank/entities/account.entity.js';
import { Transaction } from '../../../bank/entities/transaction.entity.js';
import { LedgerQuery } from '../../../bank/ledger.query.js';

describe('bank ledger SQL (MySQL)', () => {
  let ds: DataSource;
  let accounts: Repository<Account>;
  let transactions: Repository<Transaction>;
  let ledger: LedgerQuery;
  let balances: AccountBalancesQuery;

  async function insertAccount(fields: Partial<Account> = {}): Promise<Account> {
    return accounts.save(accounts.create({
      userId: 1,
      organizationId: null,
      type: 'regular',
      name: `Account ${Math.random()}`,
      currency: 'BRL',
      openingDate: '2026-11-01',
      openingBalance: 0n,
      ...fields,
    }));
  }

  async function insertTransaction(accountId: number, date: string, amount: bigint): Promise<Transaction> {
    return transactions.save(transactions.create({ accountId, date, amount, description: `${date} ${amount}` }));
  }

  beforeAll(async () => {
    ds = await createTestDataSource();
    accounts = ds.getRepository(Account);
    transactions = ds.getRepository(Transaction);
    ledger = new LedgerQuery(transactions);
    balances = new AccountBalancesQuery(transactions);
  });

  beforeEach(async () => {
    await resetDatabase(ds);
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('round-trips BIGINT amounts as bigint and DATE as a string', async () => {
    const account = await insertAccount({ openingBalance: 10n ** 13n });
    const reloaded = await accounts.findOneByOrFail({ id: account.id });

    expect(reloaded.openingBalance).toBe(10n ** 13n);
    expect(reloaded.openingDate).toBe('2026-11-01');
  });

  it('works through the worked backfilling example', async () => {
    const account = await insertAccount({ openingDate: '2026-11-01', openingBalance: 1_000_000n });
    await insertTransaction(account.id, '2026-10-05', 1_500_000n);
    await insertTransaction(account.id, '2026-10-20', -1_000_000n);

    expect(await ledger.openingEffective(account)).toBe(500_000n);
    expect((await ledger.page(account, 1, 50)).map((row) => row.balance)).toEqual([1_000_000n, 2_000_000n]);
    expect(await balances.currentBalance(account)).toBe(1_000_000n);
  });

  it('counts a transaction dated on opening_date after the anchor', async () => {
    const account = await insertAccount({ openingDate: '2026-11-01', openingBalance: 1000n });
    await insertTransaction(account.id, '2026-11-01', 250n);
    await insertTransaction(account.id, '2026-10-31', -100n);

    expect(await ledger.openingEffective(account)).toBe(1100n);
    expect(await balances.currentBalance(account)).toBe(1250n);
    expect((await ledger.page(account, 1, 50)).map((row) => [row.date, row.amount, row.balance])).toEqual([
      ['2026-11-01', 250n, 1250n],
      ['2026-10-31', -100n, 1000n],
    ]);
  });

  it('maps sent_to_accountant_at as a Date, or null when unsent', async () => {
    const account = await insertAccount();
    const sent = await insertTransaction(account.id, '2026-11-02', -1n);
    await insertTransaction(account.id, '2026-11-01', -2n);
    await ds.query('UPDATE bank_transactions SET sent_to_accountant_at = ? WHERE id = ?', ['2026-11-09 12:00:00', sent.id]);

    const rows = await ledger.page(account, 1, 50);

    expect(rows[0].sentToAccountantAt).toBeInstanceOf(Date);
    expect(rows[1].sentToAccountantAt).toBeNull();
  });

  it('orders newest first, by id within a day', async () => {
    const account = await insertAccount();
    const first = await insertTransaction(account.id, '2026-11-02', 1n);
    const second = await insertTransaction(account.id, '2026-11-02', 2n);
    const older = await insertTransaction(account.id, '2026-11-01', 3n);
    const newest = await insertTransaction(account.id, '2026-11-03', 4n);

    expect((await ledger.page(account, 1, 50)).map((row) => row.id)).toEqual([newest.id, second.id, first.id, older.id]);
  });

  it('pages 50 rows with running balances correct across page boundaries', async () => {
    const account = await insertAccount({ openingDate: '2026-01-01', openingBalance: 100n });
    for (let day = 1; day <= 120; day++) {
      const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
      await insertTransaction(account.id, date, BigInt(day));
    }

    expect(await ledger.count(account.id)).toBe(120);

    const pages = [await ledger.page(account, 1, 50), await ledger.page(account, 2, 50), await ledger.page(account, 3, 50)];
    expect(pages.map((page) => page.length)).toEqual([50, 50, 20]);

    const all = pages.flat();
    // Newest first: the row of day d has balance 100 + 1 + 2 + … + d.
    all.forEach((row) => {
      const day = Number(row.amount);
      expect(row.balance).toBe(100n + BigInt((day * (day + 1)) / 2));
    });
    expect(all[0].amount).toBe(120n);
    expect(all[119].amount).toBe(1n);
    expect(await ledger.page(account, 4, 50)).toEqual([]);
  });

  it('keeps each account ledger separate', async () => {
    const mine = await insertAccount({ openingBalance: 0n });
    const other = await insertAccount({ openingBalance: 0n });
    await insertTransaction(mine.id, '2026-11-02', 5n);
    await insertTransaction(other.id, '2026-11-02', 7n);

    expect(await ledger.count(mine.id)).toBe(1);
    expect((await ledger.page(mine, 1, 50)).map((row) => row.balance)).toEqual([5n]);
  });

  it('computes every current balance with the grouped query', async () => {
    const first = await insertAccount({ openingDate: '2026-11-01', openingBalance: 100n });
    const second = await insertAccount({ openingDate: '2026-11-01', openingBalance: 0n });
    const empty = await insertAccount({ openingBalance: 42n });
    await insertTransaction(first.id, '2026-11-02', 10n);
    await insertTransaction(first.id, '2026-10-01', 999n);
    await insertTransaction(second.id, '2026-11-01', -30n);

    expect(await balances.currentBalances([first, second, empty])).toEqual(
      new Map([[first.id, 110n], [second.id, -30n], [empty.id, 42n]]),
    );
    expect(await balances.hasTransactions(first.id)).toBe(true);
    expect(await balances.hasTransactions(empty.id)).toBe(false);
  });
});
