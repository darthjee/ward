import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderBill } from './entities/provider-bill.entity.js';

/** Bill totals of one provider account, in its currency's minor units. */
export interface ProviderBillsSummary {
  count: number;
  monthly: bigint;
  yearly: bigint;
}

interface SummaryRow {
  providerAccountId: number | string;
  count: number | string;
  monthly: string | null;
  yearly: string | null;
}

/**
 * Aggregate reads over `bank_provider_bills` for the provider list's
 * `bills_summary`. Callers have already scoped the accounts to their owner.
 */
@Injectable()
export class ProviderBillsSummaryQuery {
  private readonly billRepository: Repository<ProviderBill>;

  /**
   * @param {Repository<ProviderBill>} billRepository - The provider bill repository.
   */
  constructor(@InjectRepository(ProviderBill) billRepository: Repository<ProviderBill>) {
    this.billRepository = billRepository;
  }

  /**
   * Summarises the bills of every given provider account with **one** grouped
   * query (`COUNT`/`SUM … GROUP BY provider_account_id`). `count` covers every
   * bill; `monthly`/`yearly` sum `expected_amount` of recurring bills with that
   * frequency (null amounts and one-offs excluded). Accounts without bills get
   * zeros.
   * @param {number[]} accountIds - The (owner-scoped) provider account ids.
   * @returns {Promise<Map<number, ProviderBillsSummary>>} The summary, by account id.
   */
  async summaries(accountIds: number[]): Promise<Map<number, ProviderBillsSummary>> {
    const summaries = new Map<number, ProviderBillsSummary>(
      accountIds.map((id) => [id, { count: 0, monthly: 0n, yearly: 0n }]),
    );

    if (accountIds.length === 0) {
      return summaries;
    }

    const rows: SummaryRow[] = await this.billRepository
      .createQueryBuilder('b')
      .select('b.provider_account_id', 'providerAccountId')
      .addSelect('COUNT(*)', 'count')
      .addSelect("SUM(CASE WHEN b.kind = 'recurring' AND b.charge_frequency = 'monthly' THEN b.expected_amount END)", 'monthly')
      .addSelect("SUM(CASE WHEN b.kind = 'recurring' AND b.charge_frequency = 'yearly' THEN b.expected_amount END)", 'yearly')
      .where('b.provider_account_id IN (:...ids)', { ids: [...summaries.keys()] })
      .groupBy('b.provider_account_id')
      .getRawMany();

    for (const row of rows) {
      summaries.set(Number(row.providerAccountId), {
        count: Number(row.count),
        monthly: BigInt(row.monthly ?? 0),
        yearly: BigInt(row.yearly ?? 0),
      });
    }

    return summaries;
  }
}
