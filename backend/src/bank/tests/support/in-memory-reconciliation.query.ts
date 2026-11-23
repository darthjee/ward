import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { InMemoryBankRepo } from './in-memory-bank-repos.js';
import { checkOpenKey } from './in-memory-reconciliation-repos.js';
import { Reconciliation } from '../../entities/reconciliation.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';
import { HISTORY_PER_PAGE } from '../../pagination.js';
import type { HistoryPage, LockedTransaction } from '../../reconciliation.query.js';

// TypeScript stand-in for the bulk / grouped SQL of `ReconciliationQuery`, which the in-memory
// repositories cannot run. The bank e2e specs swap it in with `jest.mock('../reconciliation.query.js', ...)`
// (same class name and constructor injection), so the lazy `BankModule` is still wired unmodified.
// The `manager` argument is ignored: the in-memory repos are shared. The real SQL is covered by
// `reconciliation.integration-spec.ts`.

type Manager = unknown;

@Injectable()
export class ReconciliationQuery {
  /** The ids of every `lockTransactions` call, in order. */
  static lockCalls: number[][] = [];
  /** How many grouped count queries ran (never one per row). */
  static countCalls = 0;
  private readonly reconciliations: InMemoryBankRepo<Reconciliation>;
  private readonly transactions: InMemoryBankRepo<Transaction>;

  constructor(
  @InjectRepository(Reconciliation) reconciliations: InMemoryBankRepo<Reconciliation>,
    @InjectRepository(Transaction) transactions: InMemoryBankRepo<Transaction>,
  ) {
    this.reconciliations = reconciliations;
    this.transactions = transactions;
  }

  async lockTransactions(_manager: Manager, accountId: number, ids: number[]): Promise<LockedTransaction[]> {
    ReconciliationQuery.lockCalls.push([...ids]);

    return this.transactions.rows
      .filter((row) => row.accountId === accountId && ids.includes(row.id))
      .sort((a, b) => a.id - b.id)
      .map(({ id, date, amount, reconciliationId }) => ({ id, date, amount, reconciliationId }));
  }

  async lockTicked(_manager: Manager, accountId: number, statementId: number): Promise<number[]> {
    return this.transactions.rows
      .filter((row) => row.accountId === accountId && row.reconciliationId === statementId)
      .map((row) => row.id)
      .sort((a, b) => a - b);
  }

  async tick(_manager: Manager, accountId: number, statementId: number, ids: number[]): Promise<void> {
    for (const row of this.transactions.rows) {
      if (row.accountId === accountId && ids.includes(row.id)) {
        row.reconciliationId = statementId;
      }
    }
  }

  async untick(_manager: Manager, accountId: number, statementId: number, ids: number[]): Promise<void> {
    for (const row of this.transactions.rows) {
      if (row.accountId === accountId && row.reconciliationId === statementId && ids.includes(row.id)) {
        row.reconciliationId = null;
      }
    }
  }

  async untickAfter(_manager: Manager, accountId: number, statementId: number, statementDate: string): Promise<void> {
    for (const row of this.transactions.rows) {
      if (row.accountId === accountId && row.reconciliationId === statementId && row.date > statementDate) {
        row.reconciliationId = null;
      }
    }
  }

  async markFinished(_manager: Manager, statementId: number, at: Date): Promise<boolean> {
    const row = this.reconciliations.rows.find((candidate) => candidate.id === statementId && candidate.reconciledAt === null);

    if (row) {
      row.reconciledAt = at;
    }

    return row !== undefined;
  }

  async reopen(_manager: Manager, statementId: number): Promise<boolean> {
    const row = this.reconciliations.rows.find((candidate) => candidate.id === statementId && candidate.reconciledAt !== null);

    if (row) {
      checkOpenKey({ ...row, reconciledAt: null } as Reconciliation, this.reconciliations.rows.filter((other) => other !== row));
      row.reconciledAt = null;
    }

    return row !== undefined;
  }

  async transactionCounts(statementIds: number[]): Promise<Map<number, number>> {
    ReconciliationQuery.countCalls++;

    return new Map(statementIds.map((id) => [id, this.transactions.rows.filter((row) => row.reconciliationId === id).length]));
  }

  async latestFinished(accountId: number, _manager?: Manager): Promise<Reconciliation | null> {
    const [latest] = this.#newestFirst(accountId).filter((row) => row.reconciledAt !== null);

    return latest ? this.reconciliations.create(latest) : null;
  }

  async openStatement(accountId: number, _manager?: Manager): Promise<Reconciliation | null> {
    const open = this.reconciliations.rows.find((row) => row.accountId === accountId && row.reconciledAt === null);

    return open ? this.reconciliations.create(open) : null;
  }

  async historyPage(accountId: number, page: number): Promise<HistoryPage> {
    const all = this.#newestFirst(accountId);

    return {
      rows: all.slice((page - 1) * HISTORY_PER_PAGE, page * HISTORY_PER_PAGE).map((row) => this.reconciliations.create(row)),
      total: all.length,
    };
  }

  #newestFirst(accountId: number): Reconciliation[] {
    return this.reconciliations.rows
      .filter((row) => row.accountId === accountId)
      .sort((a, b) => (a.statementDate === b.statementDate ? b.id - a.id : a.statementDate < b.statementDate ? 1 : -1));
  }
}
