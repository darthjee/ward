import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity.js';
import { Reconciliation } from './entities/reconciliation.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { clearedBalance, sumToBigInt } from './reconciliation-balance.js';

/**
 * Balance reads over `bank_transactions`. Balances are computed, never stored:
 * current balance = `opening_balance` + SUM(transactions dated on or after
 * `opening_date`). Callers have already scoped the accounts to their owner.
 */
@Injectable()
export class AccountBalancesQuery {
  private readonly transactionRepository: Repository<Transaction>;

  /**
   * @param {Repository<Transaction>} transactionRepository - The transaction repository.
   */
  constructor(@InjectRepository(Transaction) transactionRepository: Repository<Transaction>) {
    this.transactionRepository = transactionRepository;
  }

  /**
   * Computes the current balance of every given account with **one** grouped
   * query (`SUM … GROUP BY account_id`), never one query per account.
   * @param {Account[]} accounts - The (owner-scoped) accounts.
   * @returns {Promise<Map<number, bigint>>} Current balance in minor units, by account id.
   */
  async currentBalances(accounts: Account[]): Promise<Map<number, bigint>> {
    const balances = new Map(accounts.map((account) => [account.id, account.openingBalance]));

    if (accounts.length === 0) {
      return balances;
    }

    const rows: Array<{ accountId: number | string; total: string | null }> = await this.transactionRepository
      .createQueryBuilder('t')
      .innerJoin(Account, 'a', 'a.id = t.account_id')
      .select('t.account_id', 'accountId')
      .addSelect('SUM(t.amount)', 'total')
      .where('t.account_id IN (:...ids)', { ids: [...balances.keys()] })
      .andWhere('t.date >= a.opening_date')
      .groupBy('t.account_id')
      .getRawMany();

    for (const row of rows) {
      const id = Number(row.accountId);
      balances.set(id, (balances.get(id) ?? 0n) + BigInt(row.total ?? 0));
    }

    return balances;
  }

  /**
   * @param {Account} account - The (owner-scoped) account.
   * @returns {Promise<bigint>} Its current balance in minor units.
   */
  async currentBalance(account: Account): Promise<bigint> {
    const balances = await this.currentBalances([account]);

    return balances.get(account.id) as bigint;
  }

  /**
   * The cleared balance: the opening balance plus the transactions on **finished** statements,
   * counting only rows dated on or after the opening date and linked to a statement of the same
   * account (a row of another account never counts).
   * @param {Account} account - The (owner-scoped) account.
   * @returns {Promise<bigint>} Its cleared balance in minor units.
   */
  async clearedBalance(account: Account): Promise<bigint> {
    const row: { total: string | null } | undefined = await this.transactionRepository
      .createQueryBuilder('t')
      .innerJoin(Account, 'a', 'a.id = t.account_id')
      .innerJoin(
        Reconciliation,
        'r',
        'r.id = t.reconciliation_id AND r.account_id = t.account_id AND r.reconciled_at IS NOT NULL',
      )
      .select('SUM(t.amount)', 'total')
      .where('t.account_id = :account', { account: account.id })
      .andWhere('t.date >= a.opening_date')
      .getRawOne();

    return clearedBalance(account.openingBalance, sumToBigInt(row?.total));
  }

  /**
   * @param {number} accountId - The (owner-scoped) account id.
   * @param {number} reconciliationId - The open statement id.
   * @returns {Promise<bigint>} The sum of the account's transactions ticked on that statement.
   */
  async tickedSum(accountId: number, reconciliationId: number): Promise<bigint> {
    const row: { total: string | null } | undefined = await this.transactionRepository
      .createQueryBuilder('t')
      .select('SUM(t.amount)', 'total')
      .where('t.reconciliation_id = :open', { open: reconciliationId })
      .andWhere('t.account_id = :account', { account: accountId })
      .getRawOne();

    return sumToBigInt(row?.total);
  }

  /**
   * @param {number} accountId - The (owner-scoped) account id.
   * @returns {Promise<boolean>} Whether the account has at least one transaction.
   */
  async hasTransactions(accountId: number): Promise<boolean> {
    return this.transactionRepository.existsBy({ accountId });
  }
}
