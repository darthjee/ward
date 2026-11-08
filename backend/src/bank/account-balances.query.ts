import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity.js';
import { Transaction } from './entities/transaction.entity.js';

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
   * @param {number} accountId - The (owner-scoped) account id.
   * @returns {Promise<boolean>} Whether the account has at least one transaction.
   */
  async hasTransactions(accountId: number): Promise<boolean> {
    return this.transactionRepository.existsBy({ accountId });
  }
}
