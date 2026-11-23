import type { DataSource, Repository } from 'typeorm';
import { createTestDataSource, resetDatabase } from './test-data-source.js';
import { AccountBalancesQuery } from '../../../bank/account-balances.query.js';
import { Account } from '../../../bank/entities/account.entity.js';
import { Reconciliation } from '../../../bank/entities/reconciliation.entity.js';
import { Transaction } from '../../../bank/entities/transaction.entity.js';
import { LedgerQuery } from '../../../bank/ledger.query.js';
import { isMysqlError } from '../../../bank/mysql-errors.js';
import { reconciliationDifference } from '../../../bank/reconciliation-balance.js';
import { ReconciliationQuery } from '../../../bank/reconciliation.query.js';
import type { OwnerScope } from '../../../core/owner-context.js';

const ALICE: OwnerScope = { kind: 'user', userId: 1 };

describe('reconciliation SQL (MySQL)', () => {
  let ds: DataSource;
  let accounts: Repository<Account>;
  let transactions: Repository<Transaction>;
  let reconciliations: Repository<Reconciliation>;
  let ledger: LedgerQuery;
  let balances: AccountBalancesQuery;
  let query: ReconciliationQuery;

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
    query = new ReconciliationQuery(reconciliations, transactions);
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

  describe('ReconciliationQuery', () => {
    const linkOf = async (id: number): Promise<number | null> => (await transactions.findOneByOrFail({ id })).reconciliationId;

    describe('lockTransactions', () => {
      it('returns the narrow columns of the account rows among the ids, by ascending id', async () => {
        const account = await insertAccount();
        const other = await insertAccount();
        const a = await insertTransaction(account.id, '2026-02-01', 5n);
        const b = await insertTransaction(account.id, '2026-01-15', -3n);
        const foreign = await insertTransaction(other.id, '2026-02-01', 9n);

        const locked = await ds.transaction((manager) => query.lockTransactions(manager, account.id, [b.id, foreign.id, a.id, 99_999]));

        expect(locked.map((row) => row.id)).toEqual([a.id, b.id]);
        expect(locked[0]).toEqual({ id: a.id, date: '2026-02-01', amount: 5n, reconciliationId: null });
      });
    });

    describe('tick, untick and untickAfter', () => {
      it('ticks only the given rows of the account', async () => {
        const account = await insertAccount();
        const other = await insertAccount();
        const statement = await insertReconciliation(account.id, '2026-02-28');
        const mine = await insertTransaction(account.id, '2026-02-01', 5n);
        const untouched = await insertTransaction(account.id, '2026-02-02', 6n);
        const foreign = await insertTransaction(other.id, '2026-02-01', 7n);

        await ds.transaction((manager) => query.tick(manager, account.id, statement.id, [mine.id, foreign.id]));

        expect(await linkOf(mine.id)).toBe(statement.id);
        expect(await linkOf(untouched.id)).toBeNull();
        expect(await linkOf(foreign.id)).toBeNull();
      });

      it('unticks only rows ticked on that statement, leaving cleared rows alone', async () => {
        const account = await insertAccount();
        const finished = await insertReconciliation(account.id, '2026-01-31', new Date());
        const open = await insertReconciliation(account.id, '2026-02-28');
        const cleared = await insertTransaction(account.id, '2026-01-10', 1n, finished.id);
        const ticked = await insertTransaction(account.id, '2026-02-10', 2n, open.id);
        const free = await insertTransaction(account.id, '2026-02-11', 3n);

        await ds.transaction((manager) => query.untick(manager, account.id, open.id, [cleared.id, ticked.id, free.id]));

        expect(await linkOf(cleared.id)).toBe(finished.id);
        expect(await linkOf(ticked.id)).toBeNull();
        expect(await linkOf(free.id)).toBeNull();
      });

      it('unticks the rows dated after a new statement date, keeping the boundary', async () => {
        const account = await insertAccount();
        const open = await insertReconciliation(account.id, '2026-02-28');
        const before = await insertTransaction(account.id, '2026-02-10', 1n, open.id);
        const boundary = await insertTransaction(account.id, '2026-02-15', 2n, open.id);
        const after = await insertTransaction(account.id, '2026-02-16', 3n, open.id);

        await ds.transaction((manager) => query.untickAfter(manager, account.id, open.id, '2026-02-15'));

        expect(await linkOf(before.id)).toBe(open.id);
        expect(await linkOf(boundary.id)).toBe(open.id);
        expect(await linkOf(after.id)).toBeNull();
      });
    });

    describe('markFinished and reopen', () => {
      it('finishes only an open statement and reopens only a finished one, keeping the ticks', async () => {
        const account = await insertAccount();
        const statement = await insertReconciliation(account.id, '2026-02-28');
        const row = await insertTransaction(account.id, '2026-02-01', 5n, statement.id);

        expect(await ds.transaction((manager) => query.markFinished(manager, statement.id, new Date()))).toBe(true);
        expect(await ds.transaction((manager) => query.markFinished(manager, statement.id, new Date()))).toBe(false);
        expect((await reconciliations.findOneByOrFail({ id: statement.id })).reconciledAt).not.toBeNull();
        expect(await ds.transaction((manager) => query.reopen(manager, statement.id))).toBe(true);
        expect(await ds.transaction((manager) => query.reopen(manager, statement.id))).toBe(false);
        expect((await reconciliations.findOneByOrFail({ id: statement.id })).reconciledAt).toBeNull();
        expect(await linkOf(row.id)).toBe(statement.id);
      });

      it('fails a reopen with ER_DUP_ENTRY while another statement of the account is open', async () => {
        const account = await insertAccount();
        const finished = await insertReconciliation(account.id, '2026-01-31', new Date());
        await insertReconciliation(account.id, '2026-02-28');

        const failure = await ds.transaction((manager) => query.reopen(manager, finished.id)).catch((error: unknown) => error);

        expect(isMysqlError(failure, 'ER_DUP_ENTRY')).toBe(true);
      });
    });

    describe('transactionCounts', () => {
      it('counts each statement in one grouped query, with 0 for an empty one', async () => {
        const account = await insertAccount();
        const first = await insertReconciliation(account.id, '2026-01-31', new Date());
        const second = await insertReconciliation(account.id, '2026-02-28');
        const empty = await insertReconciliation(await insertAccount().then((other) => other.id), '2026-02-28');
        await insertTransaction(account.id, '2026-01-10', 1n, first.id);
        await insertTransaction(account.id, '2026-01-11', 2n, first.id);
        await insertTransaction(account.id, '2026-02-10', 3n, second.id);
        await insertTransaction(account.id, '2026-02-11', 4n);

        const counts = await query.transactionCounts([first.id, second.id, empty.id]);

        expect([...counts]).toEqual([[first.id, 2], [second.id, 1], [empty.id, 0]]);
        expect(await query.transactionCounts([])).toEqual(new Map());
      });
    });

    describe('latestFinished and openStatement', () => {
      it('finds the latest finished statement and the open one', async () => {
        const account = await insertAccount();
        await insertReconciliation(account.id, '2026-01-31', new Date());
        const latest = await insertReconciliation(account.id, '2026-02-28', new Date());
        const open = await insertReconciliation(account.id, '2026-03-31');

        expect((await query.latestFinished(account.id))?.id).toBe(latest.id);
        expect((await query.openStatement(account.id))?.id).toBe(open.id);
        expect((await ds.transaction((manager) => query.openStatement(account.id, manager)))?.id).toBe(open.id);
      });

      it('answers null when there is none', async () => {
        const account = await insertAccount();

        expect(await query.latestFinished(account.id)).toBeNull();
        expect(await query.openStatement(account.id)).toBeNull();
      });
    });

    describe('historyPage', () => {
      it('orders newest first by date then id, open statement first, and counts the total', async () => {
        const account = await insertAccount();
        const other = await insertAccount();
        const a = await insertReconciliation(account.id, '2026-01-31', new Date());
        const b = await insertReconciliation(account.id, '2026-02-28', new Date());
        const open = await insertReconciliation(account.id, '2026-03-31');
        await insertReconciliation(other.id, '2026-04-30');

        const page = await query.historyPage(account.id, 1);

        expect(page.rows.map((row) => row.id)).toEqual([open.id, b.id, a.id]);
        expect(page.total).toBe(3);
      });

      it('pages 50 per page', async () => {
        const account = await insertAccount();
        for (let month = 0; month < 51; month++) {
          const date = new Date(Date.UTC(2020, month, 1)).toISOString().slice(0, 10);
          await insertReconciliation(account.id, date, new Date());
        }

        const first = await query.historyPage(account.id, 1);
        const second = await query.historyPage(account.id, 2);

        expect([first.rows.length, second.rows.length, first.total]).toEqual([50, 1, 51]);
        expect(second.rows[0].statementDate).toBe('2020-01-01');
      });
    });
  });
});
