import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from './test-data-source.js';
import { AccountBalancesQuery } from '../../../bank/account-balances.query.js';
import { Account } from '../../../bank/entities/account.entity.js';
import { Reconciliation } from '../../../bank/entities/reconciliation.entity.js';
import { Transaction } from '../../../bank/entities/transaction.entity.js';
import { LedgerQuery } from '../../../bank/ledger.query.js';
import { reconciliationDifference } from '../../../bank/reconciliation-balance.js';
import type { OwnerScope } from '../../../core/owner-context.js';

const ALICE: OwnerScope = { kind: 'user', userId: 1 };

describe('reconciliation SQL (MySQL)', () => {
  let ds: DataSource;
  let accounts: Repository<Account>;
  let transactions: Repository<Transaction>;
  let reconciliations: Repository<Reconciliation>;
  let ledger: LedgerQuery;
  let balances: AccountBalancesQuery;

  async function insertAccount(fields: Partial<Account> = {}): Promise<Account> {
    return accounts.save(accounts.create({
      userId: 1,
      organizationId: null,
      type: 'regular',
      name: `Account ${Math.random()}`,
      currency: 'BRL',
      openingDate: '2026-01-01',
      openingBalance: 10_000n,
      ...fields,
    }));
  }

  async function insertTransaction(
    accountId: number,
    date: string,
    amount: bigint,
    reconciliationId: number | null = null,
  ): Promise<Transaction> {
    return transactions.save(transactions.create({ accountId, date, amount, description: `${date} ${amount}`, reconciliationId }));
  }

  async function insertReconciliation(
    accountId: number,
    statementDate: string,
    reconciledAt: Date | null = null,
    statementBalance = 0n,
  ): Promise<Reconciliation> {
    return reconciliations.save(reconciliations.create({ accountId, statementDate, statementBalance, reconciledAt }));
  }

  const finish = (statement: Reconciliation) => reconciliations.update({ id: statement.id }, { reconciledAt: new Date() });
  const undo = (statement: Reconciliation) => reconciliations.update({ id: statement.id }, { reconciledAt: null });

  beforeAll(async () => {
    ds = await createTestDataSource();
    accounts = ds.getRepository(Account);
    transactions = ds.getRepository(Transaction);
    reconciliations = ds.getRepository(Reconciliation);
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

  describe('clearedBalance', () => {
    it('is the opening balance when nothing is cleared', async () => {
      const account = await insertAccount();

      expect(await balances.clearedBalance(account)).toBe(10_000n);
    });

    it('counts the rows of finished statements only, and not rows before the opening date', async () => {
      const account = await insertAccount({ openingDate: '2026-11-01' });
      const finished = await insertReconciliation(account.id, '2026-11-30', new Date());
      const open = await insertReconciliation(account.id, '2026-12-31');
      await insertTransaction(account.id, '2026-11-05', 300n, finished.id);
      await insertTransaction(account.id, '2026-10-05', 9_999n, finished.id);
      await insertTransaction(account.id, '2026-12-05', 50n, open.id);
      await insertTransaction(account.id, '2026-11-06', 7n);

      expect(await balances.clearedBalance(account)).toBe(10_300n);
    });

    it('never counts a row of another account linked to this account statement', async () => {
      const account = await insertAccount();
      const other = await insertAccount();
      const finished = await insertReconciliation(account.id, '2026-11-30', new Date());
      await insertTransaction(other.id, '2026-11-05', 777n, finished.id);

      expect(await balances.clearedBalance(account)).toBe(10_000n);
    });

    it('follows a finish, an undo and a second statement', async () => {
      const account = await insertAccount();
      const first = await insertReconciliation(account.id, '2026-09-30');
      await insertTransaction(account.id, '2026-09-01', 300n, first.id);
      expect(await balances.clearedBalance(account)).toBe(10_000n);

      await finish(first);
      expect(await balances.clearedBalance(account)).toBe(10_300n);

      const second = await insertReconciliation(account.id, '2026-10-31');
      await insertTransaction(account.id, '2026-10-01', -100n, second.id);
      expect(await balances.clearedBalance(account)).toBe(10_300n);

      await finish(second);
      expect(await balances.clearedBalance(account)).toBe(10_200n);

      await undo(second);
      expect(await balances.clearedBalance(account)).toBe(10_300n);
    });

    it('balances a debt account with negative values (difference 0)', async () => {
      const account = await insertAccount({ type: 'debt', openingBalance: -50_000n });
      const statement = await insertReconciliation(account.id, '2026-10-31', null, -48_000n);
      await insertTransaction(account.id, '2026-10-01', 2_000n, statement.id);

      const cleared = await balances.clearedBalance(account);
      const ticked = await balances.tickedSum(account.id, statement.id);

      expect(reconciliationDifference(statement.statementBalance, cleared, ticked)).toBe(0n);
    });

    it('balances a zero-row statement against the opening balance', async () => {
      const account = await insertAccount({ openingBalance: 12_000n });
      const statement = await insertReconciliation(account.id, '2026-10-31', null, 12_000n);

      const cleared = await balances.clearedBalance(account);
      const ticked = await balances.tickedSum(account.id, statement.id);

      expect(ticked).toBe(0n);
      expect(reconciliationDifference(statement.statementBalance, cleared, ticked)).toBe(0n);
    });

    it('keeps full precision near the 10^13 bound', async () => {
      const account = await insertAccount({ openingBalance: 9_999_999_999_000n });
      const finished = await insertReconciliation(account.id, '2026-10-31', new Date());
      await insertTransaction(account.id, '2026-10-01', 999n, finished.id);

      expect(await balances.clearedBalance(account)).toBe(9_999_999_999_999n);
    });
  });

  describe('tickedSum', () => {
    it('sums only the rows linked to the statement and the account', async () => {
      const account = await insertAccount();
      const other = await insertAccount();
      const statement = await insertReconciliation(account.id, '2026-10-31');
      await insertTransaction(account.id, '2026-10-01', 100n, statement.id);
      await insertTransaction(account.id, '2026-10-02', 50n, statement.id);
      await insertTransaction(account.id, '2026-10-03', 9n);
      await insertTransaction(other.id, '2026-10-04', 700n, statement.id);

      expect(await balances.tickedSum(account.id, statement.id)).toBe(150n);
    });
  });

  describe('ledger reconciliation', () => {
    it('is null when uncleared, open or finished with its statement date, and keeps the running balance', async () => {
      const account = await insertAccount({ openingBalance: 0n });
      const finished = await insertReconciliation(account.id, '2026-09-30', new Date());
      const open = await insertReconciliation(account.id, '2026-10-31');
      await insertTransaction(account.id, '2026-09-01', 1n, finished.id);
      await insertTransaction(account.id, '2026-10-01', 2n, open.id);
      await insertTransaction(account.id, '2026-10-02', 4n);

      const rows = await ledger.page(ALICE, account, 1, 50);

      expect(rows.map((row) => [row.reconciliation, row.balance])).toEqual([
        [null, 7n],
        [{ id: open.id, status: 'open', statementDate: '2026-10-31' }, 3n],
        [{ id: finished.id, status: 'finished', statementDate: '2026-09-30' }, 1n],
      ]);
    });

    it('yields null for a row linked to a statement of another account', async () => {
      const account = await insertAccount();
      const other = await insertAccount();
      const foreign = await insertReconciliation(other.id, '2026-10-31');
      await insertTransaction(account.id, '2026-10-01', 2n, foreign.id);

      expect((await ledger.page(ALICE, account, 1, 50)).map((row) => row.reconciliation)).toEqual([null]);
    });
  });

  describe('lastReconciledDate', () => {
    it('is the latest finished statement date, ignoring the open one', async () => {
      const account = await insertAccount();
      await insertReconciliation(account.id, '2026-08-31', new Date());
      await insertReconciliation(account.id, '2026-09-30', new Date());
      await insertReconciliation(account.id, '2026-10-31');

      expect(await ledger.lastReconciledDate(account.id)).toBe('2026-09-30');
    });

    it('is null when there is no finished statement', async () => {
      const account = await insertAccount();
      await insertReconciliation(account.id, '2026-10-31');

      expect(await ledger.lastReconciledDate(account.id)).toBeNull();
    });
  });
});
