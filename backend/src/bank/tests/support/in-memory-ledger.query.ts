import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { InMemoryBankRepo } from './in-memory-bank-repos.js';
import type { Account } from '../../entities/account.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';
import type { LedgerRow } from '../../ledger.query.js';

// TypeScript stand-ins for the window-function / grouped SQL of `LedgerQuery` and
// `AccountBalancesQuery`, which the in-memory repositories cannot run. The bank e2e specs swap
// them in with `jest.mock(...)` (same class names and constructor injection), so the lazy
// `BankModule` is still wired unmodified. The real SQL is covered by `ledger.integration-spec.ts`.

type TransactionRepo = InMemoryBankRepo<Transaction>;

function ledgerOrder(a: Transaction, b: Transaction): number {
  return a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1;
}

function sumOf(transactions: Transaction[]): bigint {
  return transactions.reduce((total, transaction) => total + transaction.amount, 0n);
}

@Injectable()
export class LedgerQuery {
  private readonly repo: TransactionRepo;

  constructor(@InjectRepository(Transaction) repo: TransactionRepo) {
    this.repo = repo;
  }

  async count(accountId: number): Promise<number> {
    return this.repo.rows.filter((row) => row.accountId === accountId).length;
  }

  async page(account: Account, page: number, perPage: number): Promise<LedgerRow[]> {
    const ledger = this.repo.rows.filter((row) => row.accountId === account.id).sort(ledgerOrder);
    let balance = await this.openingEffective(account);
    const rows = ledger.map((row) => {
      balance += row.amount;
      return {
        id: row.id,
        date: row.date,
        amount: row.amount,
        description: row.description,
        notes: row.notes,
        sentToAccountantAt: row.sentToAccountantAt ?? null,
        balance,
      };
    });

    return rows.reverse().slice((page - 1) * perPage, page * perPage);
  }

  async openingEffective(account: Account): Promise<bigint> {
    return account.openingBalance -
      sumOf(this.repo.rows.filter((row) => row.accountId === account.id && row.date < account.openingDate));
  }
}

@Injectable()
export class AccountBalancesQuery {
  static groupedCalls = 0;
  private readonly repo: TransactionRepo;

  constructor(@InjectRepository(Transaction) repo: TransactionRepo) {
    this.repo = repo;
  }

  async currentBalances(accounts: Account[]): Promise<Map<number, bigint>> {
    AccountBalancesQuery.groupedCalls++;

    return new Map(accounts.map((account) => [
      account.id,
      account.openingBalance +
        sumOf(this.repo.rows.filter((row) => row.accountId === account.id && row.date >= account.openingDate)),
    ]));
  }

  async currentBalance(account: Account): Promise<bigint> {
    return (await this.currentBalances([account])).get(account.id) as bigint;
  }

  async hasTransactions(accountId: number): Promise<boolean> {
    return this.repo.rows.some((row) => row.accountId === accountId);
  }
}
