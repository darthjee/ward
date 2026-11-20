import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { InMemoryBankRepo } from './in-memory-bank-repos.js';
import { ProviderBill } from '../../entities/provider-bill.entity.js';
import type { ProviderBillsSummary } from '../../provider-bills-summary.query.js';

// TypeScript stand-in for the grouped SQL of `ProviderBillsSummaryQuery`, which the in-memory
// repositories cannot run. The bank e2e specs swap it in with `jest.mock(...)` (same class name
// and constructor injection), so the lazy `BankModule` is still wired unmodified. The real SQL is
// covered by `provider-bills-summary.integration-spec.ts`.

export type { ProviderBillsSummary };

function recurringSum(bills: ProviderBill[], frequency: string): bigint {
  return bills
    .filter((bill) => bill.kind === 'recurring' && bill.chargeFrequency === frequency)
    .reduce((total, bill) => total + (bill.expectedAmount ?? 0n), 0n);
}

@Injectable()
export class ProviderBillsSummaryQuery {
  static groupedCalls = 0;
  private readonly repo: InMemoryBankRepo<ProviderBill>;

  constructor(@InjectRepository(ProviderBill) repo: InMemoryBankRepo<ProviderBill>) {
    this.repo = repo;
  }

  async summaries(accountIds: number[]): Promise<Map<number, ProviderBillsSummary>> {
    if (accountIds.length > 0) {
      ProviderBillsSummaryQuery.groupedCalls++;
    }

    return new Map(accountIds.map((id) => {
      const bills = this.repo.rows.filter((bill) => bill.providerAccountId === id);

      return [id, { count: bills.length, monthly: recurringSum(bills, 'monthly'), yearly: recurringSum(bills, 'yearly') }];
    }));
  }
}
