import { QueryFailedError } from 'typeorm';
import { createInMemoryBankRepos, type InMemoryBankRepos } from './in-memory-bank-repos.js';
import { AccountBalancesQuery, LedgerQuery } from './in-memory-ledger.query.js';
import { buildAccount } from '../account.test-support.js';

async function seed(repos: InMemoryBankRepos) {
  const account = await repos.accounts.save(repos.accounts.create({ ...buildAccount({ id: undefined }) }));
  const statement = await repos.reconciliations.save(
    repos.reconciliations.create({ accountId: account.id, statementDate: '2026-10-31', statementBalance: 0n, reconciledAt: null }),
  );

  return { account, statement };
}

function transaction(repos: InMemoryBankRepos, fields: Record<string, unknown>) {
  return repos.transactions.save(
    repos.transactions.create({ accountId: 1, date: '2026-05-01', amount: 100n, description: 'x', notes: null, ...fields }),
  );
}

describe('in-memory reconciliation repository', () => {
  it('rejects a second open statement for the account and releases the key once reconciled', async () => {
    const repos = createInMemoryBankRepos();
    const { account, statement } = await seed(repos);
    const second = () => repos.reconciliations.save(
      repos.reconciliations.create({ accountId: account.id, statementDate: '2026-11-30', statementBalance: 0n, reconciledAt: null }),
    );

    await expect(second()).rejects.toBeInstanceOf(QueryFailedError);

    statement.reconciledAt = new Date();
    await repos.reconciliations.save(statement);

    await expect(second()).resolves.toBeDefined();
  });

  it('sets reconciliationId to null on the ticked transactions when the statement is deleted', async () => {
    const repos = createInMemoryBankRepos();
    const { statement } = await seed(repos);
    await transaction(repos, { reconciliationId: statement.id });
    await transaction(repos, {});

    await repos.reconciliations.delete({ id: statement.id });

    expect(repos.transactions.rows.map((row) => row.reconciliationId)).toEqual([null, null]);
    expect(repos.transactions.rows).toHaveLength(2);
  });

  it('defaults reconciliationId to null on new transactions', () => {
    expect(createInMemoryBankRepos().transactions.create({}).reconciliationId).toBeNull();
  });

  it('cascades the account deletion to its reconciliations', async () => {
    const repos = createInMemoryBankRepos();
    const { account } = await seed(repos);

    await repos.accounts.delete({ id: account.id });

    expect(repos.reconciliations.rows).toEqual([]);
  });

  it('records the pessimistic_write lock of a locked read', async () => {
    const repos = createInMemoryBankRepos();
    const { statement } = await seed(repos);

    await repos.reconciliations.findOne({ where: { id: statement.id }, lock: { mode: 'pessimistic_write' } });

    expect(repos.reconciliations.locks).toEqual(['pessimistic_write']);
  });
});

describe('in-memory reconciliation queries', () => {
  async function setup() {
    const repos = createInMemoryBankRepos();
    const { account, statement } = await seed(repos);
    const finished = await repos.reconciliations.save(
      repos.reconciliations.create({
        accountId: account.id, statementDate: '2026-09-30', statementBalance: 0n, reconciledAt: new Date(),
      }),
    );
    const balances = new AccountBalancesQuery(repos.transactions as never, repos.reconciliations as never);
    const ledger = new LedgerQuery(
      repos.transactions as never, repos.billPayments as never, repos.accounts as never, repos.reconciliations as never,
    );

    return { repos, account, statement, finished, balances, ledger };
  }

  it('clearedBalance counts only finished statements, from the anchor on, of the same account', async () => {
    const { repos, account, statement, finished, balances } = await setup();
    await transaction(repos, { accountId: account.id, amount: 300n, reconciliationId: finished.id });
    await transaction(repos, { accountId: account.id, amount: 50n, reconciliationId: statement.id });
    await transaction(repos, { accountId: account.id, amount: 7n, date: '2025-01-01', reconciliationId: finished.id });
    await transaction(repos, { accountId: account.id + 1, amount: 9n, reconciliationId: finished.id });

    await expect(balances.clearedBalance(account)).resolves.toBe(account.openingBalance + 300n);
    await expect(balances.tickedSum(account.id, statement.id)).resolves.toBe(50n);
    await expect(balances.tickedSum(account.id, 999)).resolves.toBe(0n);
  });

  it('ledger rows carry their statement and lastReconciledDate the latest finished one', async () => {
    const { repos, account, statement, finished, ledger } = await setup();
    await transaction(repos, { accountId: account.id, date: '2026-05-01', reconciliationId: finished.id });
    await transaction(repos, { accountId: account.id, date: '2026-05-02', reconciliationId: statement.id });
    await transaction(repos, { accountId: account.id, date: '2026-05-03' });

    const rows = await ledger.page({ kind: 'user', userId: 7 }, account, 1, 50);

    expect(rows.map((row) => row.reconciliation)).toEqual([
      null,
      { id: statement.id, status: 'open', statementDate: '2026-10-31' },
      { id: finished.id, status: 'finished', statementDate: '2026-09-30' },
    ]);
    await expect(ledger.lastReconciledDate(account.id)).resolves.toBe('2026-09-30');
    await expect(ledger.lastReconciledDate(account.id + 1)).resolves.toBeNull();
  });
});
