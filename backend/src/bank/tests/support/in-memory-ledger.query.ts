import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { InMemoryBankRepo } from './in-memory-bank-repos.js';
import { paymentGeneratedIds } from './in-memory-payment-generated.query.js';
import type { OwnerScope } from '../../../core/owner-context.js';
import { Account } from '../../entities/account.entity.js';
import { BillPayment } from '../../entities/bill-payment.entity.js';
import { Reconciliation } from '../../entities/reconciliation.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';
import type { LedgerRow } from '../../ledger.query.js';
import { clearedBalance, reconciliationStatus } from '../../reconciliation-balance.js';

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
  private readonly billPayments: InMemoryBankRepo<BillPayment>;
  private readonly accounts: InMemoryBankRepo<Account>;
  private readonly reconciliations: InMemoryBankRepo<Reconciliation>;

  constructor(
    @InjectRepository(Transaction) repo: TransactionRepo,
    @InjectRepository(BillPayment) billPayments: InMemoryBankRepo<BillPayment>,
    @InjectRepository(Account) accounts: InMemoryBankRepo<Account>,
    @InjectRepository(Reconciliation) reconciliations: InMemoryBankRepo<Reconciliation>,
  ) {
    this.repo = repo;
    this.billPayments = billPayments;
    this.accounts = accounts;
    this.reconciliations = reconciliations;
  }

  async count(accountId: number): Promise<number> {
    return this.repo.rows.filter((row) => row.accountId === accountId).length;
  }

  async page(owner: OwnerScope, account: Account, page: number, perPage: number): Promise<LedgerRow[]> {
    const generated = paymentGeneratedIds(owner, this.billPayments, this.accounts);
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
        paymentGenerated: generated.has(row.id),
        reconciliation: this.#reconciliationOf(row),
        balance,
      };
    });

    return rows.reverse().slice((page - 1) * perPage, page * perPage);
  }

  async openingEffective(account: Account): Promise<bigint> {
    return account.openingBalance -
      sumOf(this.repo.rows.filter((row) => row.accountId === account.id && row.date < account.openingDate));
  }

  async lastReconciledDate(accountId: number): Promise<string | null> {
    const dates = this.reconciliations.rows
      .filter((row) => row.accountId === accountId && row.reconciledAt !== null)
      .map((row) => row.statementDate)
      .sort();

    return dates.at(-1) ?? null;
  }

  // The scoped `LEFT JOIN`: a row only joins a statement of its own account.
  #reconciliationOf(row: Transaction): LedgerRow['reconciliation'] {
    const statement = this.reconciliations.rows.find(
      (candidate) => candidate.id === row.reconciliationId && candidate.accountId === row.accountId,
    );

    return statement
      ? { id: statement.id, status: reconciliationStatus(statement.reconciledAt), statementDate: statement.statementDate }
      : null;
  }
}

@Injectable()
export class AccountBalancesQuery {
  static groupedCalls = 0;
  private readonly repo: TransactionRepo;
  private readonly reconciliations: InMemoryBankRepo<Reconciliation>;

  constructor(
    @InjectRepository(Transaction) repo: TransactionRepo,
    @InjectRepository(Reconciliation) reconciliations: InMemoryBankRepo<Reconciliation>,
  ) {
    this.repo = repo;
    this.reconciliations = reconciliations;
  }

  async clearedBalance(account: Account): Promise<bigint> {
    const finished = new Set(
      this.reconciliations.rows.filter((row) => row.accountId === account.id && row.reconciledAt !== null).map((row) => row.id),
    );
    const cleared = this.repo.rows.filter((row) =>
      row.accountId === account.id &&
      row.date >= account.openingDate &&
      row.reconciliationId !== null &&
      finished.has(row.reconciliationId));

    return clearedBalance(account.openingBalance, sumOf(cleared));
  }

  async tickedSum(accountId: number, reconciliationId: number): Promise<bigint> {
    return sumOf(this.repo.rows.filter((row) => row.accountId === accountId && row.reconciliationId === reconciliationId));
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
