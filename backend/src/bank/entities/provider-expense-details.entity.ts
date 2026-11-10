import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Account } from './account.entity.js';
import { bigintTransformer } from './bigint.transformer.js';

/** How often a provider charges. */
export type ProviderChargeFrequency = 'monthly' | 'yearly';

/**
 * The provider-expense-specific details of an {@link Account} of type
 * `provider_expense` (see `docs/agents/specs/banking/accounts/provider-expense.md`).
 * Owns table `bank_provider_expense_details`, 1:1 with `bank_accounts`:
 * `accountId` is both the primary key and a real FK (`ON DELETE CASCADE`). It
 * never stores an owner: it inherits it through its account.
 */
@Entity('bank_provider_expense_details')
export class ProviderExpenseDetails {
  @PrimaryColumn({ name: 'account_id', type: 'int' })
    accountId!: number;

  @OneToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
    account?: Account;

  @Column({ name: 'for_accountant', type: 'boolean', default: true })
    forAccountant!: boolean;

  /** Free text (not always a CNPJ), at most 32 code points. */
  @Column({ name: 'provider_tax_id', type: 'varchar', length: 32, nullable: true })
    providerTaxId!: string | null;

  /** Integer minor units of the account's currency. */
  @Column({ name: 'expected_amount', type: 'bigint', nullable: true, transformer: bigintTransformer })
    expectedAmount!: bigint | null;

  @Column({ name: 'due_day', type: 'tinyint', nullable: true })
    dueDay!: number | null;

  @Column({ name: 'charge_frequency', type: 'varchar', length: 16, default: 'monthly' })
    chargeFrequency!: ProviderChargeFrequency;

  @Column({ name: 'due_month', type: 'tinyint', nullable: true })
    dueMonth!: number | null;

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
