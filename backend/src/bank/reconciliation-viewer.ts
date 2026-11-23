import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { AccountBalancesQuery } from './account-balances.query.js';
import type { Account } from './entities/account.entity.js';
import type { Reconciliation } from './entities/reconciliation.entity.js';
import { presentStatement, type StatementResponse } from './reconciliation-response.js';
import { ReconciliationQuery } from './reconciliation.query.js';

/**
 * Computes the live values of a statement (cleared balance, ticked sum, row count: each one SQL
 * aggregate, never in-memory work over rows) and presents it. Writes pass their transaction's
 * manager, so the response is computed under the locks they hold.
 */
@Injectable()
export class ReconciliationViewer {
  private readonly balances: AccountBalancesQuery;
  private readonly query: ReconciliationQuery;

  /**
   * @param {AccountBalancesQuery} balances - The cleared balance and ticked sum SQL.
   * @param {ReconciliationQuery} query - The grouped count SQL.
   */
  constructor(balances: AccountBalancesQuery, query: ReconciliationQuery) {
    this.balances = balances;
    this.query = query;
  }

  /**
   * @param {Reconciliation} statement - The statement.
   * @param {Account} account - Its account.
   * @param {EntityManager} [manager] - The write transaction's manager, when inside one.
   * @returns {Promise<StatementResponse>} The statement's public view. A finished statement does
   *   not need the account's cleared balance, so that query is skipped for it.
   */
  async view(statement: Reconciliation, account: Account, manager?: EntityManager): Promise<StatementResponse> {
    const tickedSum = await this.balances.tickedSum(account.id, statement.id, manager);
    const clearedBalance = statement.reconciledAt === null ? await this.balances.clearedBalance(account, manager) : null;
    const counts = await this.query.transactionCounts([statement.id]);

    return presentStatement(
      statement,
      { clearedBalance, tickedSum, transactionCount: counts.get(statement.id) ?? 0 },
      account.currency,
    );
  }
}
