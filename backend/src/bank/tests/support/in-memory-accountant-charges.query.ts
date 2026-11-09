import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { InMemoryBankRepo, InMemoryProviderExpenseDetailsRepo } from './in-memory-bank-repos.js';
import type { OwnerContext } from '../../../core/owner-context.js';
import type { AccountantChargeRow, ResolvedMarkRow } from '../../accountant-charges.query.js';
import { Account } from '../../entities/account.entity.js';
import { ProviderExpenseDetails } from '../../entities/provider-expense-details.entity.js';
import { Transaction } from '../../entities/transaction.entity.js';

// TypeScript stand-in for the raw SQL of `AccountantChargesQuery`, which the in-memory
// repositories cannot run. The bank e2e specs swap it in with `jest.mock(...)` (same class name
// and exports), so the lazy `BankModule` is still wired unmodified. The real SQL (owner filter,
// joins, `FOR UPDATE OF t`) is covered by `accountant.integration-spec.ts`.

export const PREVIEW_MAX_ROWS = 1000;

export type { AccountantChargeRow, ResolvedMarkRow };

function ownedBy(account: Account, owner: OwnerContext): boolean {
  return owner.kind === 'user'
    ? account.userId === owner.userId && account.organizationId === null
    : account.userId === null && account.organizationId === owner.organizationId;
}

function byDateThenId(a: Transaction, b: Transaction): number {
  return a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1;
}

@Injectable()
export class AccountantChargesQuery {
  static resolveCalls = 0;
  private readonly transactions: InMemoryBankRepo<Transaction>;
  private readonly accounts: InMemoryBankRepo<Account>;
  private readonly details: InMemoryProviderExpenseDetailsRepo;

  constructor(
    @InjectRepository(Transaction) transactions: InMemoryBankRepo<Transaction>,
    @InjectRepository(Account) accounts: InMemoryBankRepo<Account>,
    @InjectRepository(ProviderExpenseDetails) details: InMemoryProviderExpenseDetailsRepo,
  ) {
    this.transactions = transactions;
    this.accounts = accounts;
    this.details = details;
  }

  async preview(owner: OwnerContext, from: string, to: string, includeSent: boolean): Promise<AccountantChargeRow[]> {
    const rows: AccountantChargeRow[] = [];
    const charges = this.transactions.rows
      .filter((row) => row.amount < 0n && row.date >= from && row.date <= to)
      .filter((row) => includeSent || !row.sentToAccountantAt)
      .sort(byDateThenId);

    for (const charge of charges) {
      const account = this.#account(charge.accountId);
      const details = this.#details(charge.accountId);

      if (account && ownedBy(account, owner) && account.type === 'provider_expense' && details?.forAccountant) {
        rows.push({
          id: charge.id,
          date: charge.date,
          description: charge.description,
          amount: charge.amount,
          sentToAccountantAt: charge.sentToAccountantAt ?? null,
          accountId: account.id,
          accountName: account.name,
          bankName: account.bankName,
          providerTaxId: details.providerTaxId,
          currency: account.currency,
        });
      }
    }

    return rows.slice(0, PREVIEW_MAX_ROWS + 1);
  }

  async resolveForUpdate(_manager: unknown, owner: OwnerContext, ids: number[]): Promise<ResolvedMarkRow[]> {
    AccountantChargesQuery.resolveCalls++;

    return this.transactions.rows
      .filter((row) => ids.includes(row.id))
      .flatMap((row) => {
        const account = this.#account(row.accountId);
        if (!account || !ownedBy(account, owner)) return [];

        const details = this.#details(row.accountId);
        return [{
          id: row.id,
          amount: row.amount,
          sentToAccountantAt: row.sentToAccountantAt ?? null,
          type: account.type,
          forAccountant: details ? details.forAccountant : null,
        }];
      });
  }

  async stamp(_manager: unknown, ids: number[], now: Date): Promise<void> {
    for (const row of this.transactions.rows) {
      if (ids.includes(row.id) && !row.sentToAccountantAt) row.sentToAccountantAt = now;
    }
  }

  async clear(_manager: unknown, ids: number[]): Promise<void> {
    for (const row of this.transactions.rows) {
      if (ids.includes(row.id)) row.sentToAccountantAt = null;
    }
  }

  #account(id: number): Account | undefined {
    return this.accounts.rows.find((account) => account.id === id);
  }

  #details(accountId: number): ProviderExpenseDetails | undefined {
    return this.details.rows.find((details) => details.accountId === accountId);
  }
}
