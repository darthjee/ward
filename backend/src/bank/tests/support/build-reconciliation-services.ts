import { createInMemoryBankRepos } from './in-memory-bank-repos.js';
import { AccountBalancesQuery } from './in-memory-ledger.query.js';
import { ReconciliationQuery } from './in-memory-reconciliation.query.js';
import type { OwnerContext } from '../../../core/owner-context.js';
import { ownerNotFound } from '../../../core/parse-id.js';
import { Account } from '../../entities/account.entity.js';
import { Reconciliation } from '../../entities/reconciliation.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';
import { ReconciliationLifecycleWriter } from '../../reconciliation-lifecycle.writer.js';
import { ReconciliationTicksWriter } from '../../reconciliation-ticks.writer.js';
import { ReconciliationViewer } from '../../reconciliation-viewer.js';
import { ReconciliationService } from '../../reconciliation.service.js';
import { buildAccount, PERSONAL } from '../account.test-support.js';

const ENTITY_NAMES = new Map<unknown, string>([[Account, 'Account'], [Reconciliation, 'Reconciliation'], [Transaction, 'Transaction']]);

/**
 * Builds the reconciliation service graph over the in-memory bank repositories and the in-memory
 * query twins (no DB, no Nest). `lockOrder` records every locked read in the order the writers
 * take them: `Account`, `Reconciliation`, then `Transaction` (the locking select).
 * @returns {object} The services, the repositories, the lock order and seeding helpers.
 */
export function buildReconciliationServices() {
  const repos = createInMemoryBankRepos();
  const lockOrder: string[] = [];
  const query = new ReconciliationQuery(repos.reconciliations as never, repos.transactions as never);
  const balances = new AccountBalancesQuery(repos.transactions as never, repos.reconciliations as never);
  const lockTransactions = query.lockTransactions.bind(query);
  query.lockTransactions = async (...args) => {
    lockOrder.push('Transaction');
    return lockTransactions(...args);
  };
  const lockTicked = query.lockTicked.bind(query);
  query.lockTicked = async (...args) => {
    lockOrder.push('Transaction');
    return lockTicked(...args);
  };

  const repositoryFor = (entity: unknown): Record<string, unknown> => {
    const repo = (entity === Account ? repos.accounts : entity === Transaction ? repos.transactions : repos.reconciliations) as
      unknown as Record<string, (...args: unknown[]) => unknown>;

    return {
      ...repo,
      manager,
      findOne: (options: { lock?: { mode: string } }) => {
        if (options.lock?.mode === 'pessimistic_write') lockOrder.push(ENTITY_NAMES.get(entity) as string);
        return repo.findOne(options);
      },
    };
  };
  const manager = {
    getRepository: repositoryFor,
    transaction: async <R>(work: (m: unknown) => Promise<R>): Promise<R> => work(manager),
  };
  const reconciliationRepository = repositoryFor(Reconciliation);
  const viewer = new ReconciliationViewer(balances as never, query as never);
  const lifecycle = new ReconciliationLifecycleWriter(reconciliationRepository as never, query as never, balances as never, viewer);
  const ticks = new ReconciliationTicksWriter(reconciliationRepository as never, query as never, viewer);
  const accounts = {
    findOwned: async (_owner: OwnerContext, id: number): Promise<Account> => {
      const found = await repos.accounts.findOneBy({ id, userId: 7 });

      if (!found) throw ownerNotFound();

      return found;
    },
  };
  const service = new ReconciliationService(reconciliationRepository as never, accounts as never, query as never, viewer, lifecycle, ticks);

  const seedAccount = (fields: Partial<Account> = {}): Promise<Account> =>
    repos.accounts.save(buildAccount({ id: undefined, ...fields }));
  const seedTransaction = (accountId: number, date: string, amount: bigint, reconciliationId: number | null = null): Promise<Transaction> =>
    repos.transactions.save(repos.transactions.create({ accountId, date, amount, description: `${date} ${amount}`, notes: null, reconciliationId }));
  const seedStatement = (accountId: number, statementDate: string, statementBalance: bigint, finished = false): Promise<Reconciliation> =>
    repos.reconciliations.save(repos.reconciliations.create({
      accountId,
      statementDate,
      statementBalance,
      reconciledAt: finished ? new Date('2026-03-01T00:00:00Z') : null,
    }));

  return { repos, manager, lockOrder, query, service, owner: PERSONAL, seedAccount, seedTransaction, seedStatement };
}

export type ReconciliationServices = ReturnType<typeof buildReconciliationServices>;
