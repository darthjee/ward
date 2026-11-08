import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Account } from './account.entity.js';

/** The kind of product an investment account holds. */
export type InvestmentKind = 'fixed_income' | 'fund' | 'stocks' | 'savings' | 'pension' | 'crypto' | 'other';

/** How often an investment's yield rate applies. */
export type InvestmentYieldPeriod = 'monthly' | 'yearly';

/**
 * The investment-specific details of an {@link Account} of type `investment`
 * (see `docs/agents/specs/banking/accounts/investment.md`). Owns table
 * `bank_investment_details`, 1:1 with `bank_accounts`: `accountId` is both
 * the primary key and a real FK (`ON DELETE CASCADE`). It never stores an
 * owner: it inherits it through its account. Every field is informational
 * only and never used in any computation.
 */
@Entity('bank_investment_details')
export class InvestmentDetails {
  @PrimaryColumn({ name: 'account_id', type: 'int' })
    accountId!: number;

  @OneToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
    account?: Account;

  @Column({ name: 'kind', type: 'varchar', length: 16, nullable: true })
    kind!: InvestmentKind | null;

  /** Percent per `yieldPeriod`, `DECIMAL(7,4)` as a string (e.g. `"12.5000"`). */
  @Column({ name: 'yield_rate', type: 'decimal', precision: 7, scale: 4, nullable: true })
    yieldRate!: string | null;

  @Column({ name: 'yield_period', type: 'varchar', length: 16, nullable: true })
    yieldPeriod!: InvestmentYieldPeriod | null;

  /** `YYYY-MM-DD`; may be in the past. */
  @Column({ name: 'maturity_date', type: 'date', nullable: true })
    maturityDate!: string | null;

  /** D+N redemption delay in days; `0` = daily liquidity. */
  @Column({ name: 'liquidity_days', type: 'int', nullable: true })
    liquidityDays!: number | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
