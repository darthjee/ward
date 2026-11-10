import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Account } from './account.entity.js';
import { bigintTransformer } from './bigint.transformer.js';

/** How often a debt's interest rate or instalment applies. */
export type DebtPeriod = 'monthly' | 'yearly';

/**
 * The debt-specific details of an {@link Account} of type `debt` (see
 * `docs/agents/specs/banking/accounts/debt.md`). Owns table
 * `bank_debt_details`, 1:1 with `bank_accounts`: `accountId` is both the
 * primary key and a real FK (`ON DELETE CASCADE`). It never stores an owner:
 * it inherits it through its account.
 */
@Entity('bank_debt_details')
export class DebtDetails {
  @PrimaryColumn({ name: 'account_id', type: 'int' })
    accountId!: number;

  @OneToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
    account?: Account;

  /** Percent per `interestPeriod`, `DECIMAL(7,4)` as a string (e.g. `"1.9900"`). */
  @Column({ name: 'interest_rate', type: 'decimal', precision: 7, scale: 4, nullable: true })
    interestRate!: string | null;

  @Column({ name: 'interest_period', type: 'varchar', length: 16, nullable: true })
    interestPeriod!: DebtPeriod | null;

  /** Integer minor units of the account's currency. */
  @Column({ name: 'instalment_amount', type: 'bigint', nullable: true, transformer: bigintTransformer })
    instalmentAmount!: bigint | null;

  @Column({ name: 'instalment_frequency', type: 'varchar', length: 16, default: 'monthly' })
    instalmentFrequency!: DebtPeriod;

  @Column({ name: 'due_day', type: 'tinyint', nullable: true })
    dueDay!: number | null;

  @Column({ name: 'due_month', type: 'tinyint', nullable: true })
    dueMonth!: number | null;

  @Column({ name: 'instalment_count', type: 'int', nullable: true })
    instalmentCount!: number | null;

  /** `YYYY-MM-DD`; the first bill occurrence is the first due date on or after it (see `bills.md`). */
  @Column({ name: 'bills_from', type: 'date', nullable: true })
    billsFrom!: string | null;

  /** When `false`, the account never produces bill occurrences. */
  @Column({ name: 'show_in_calendar', type: 'boolean', default: true })
    showInCalendar!: boolean;

  /** Default paying account of its bills (a real FK, `ON DELETE SET NULL`). */
  @Column({ name: 'paying_account_id', type: 'int', nullable: true })
    payingAccountId!: number | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
