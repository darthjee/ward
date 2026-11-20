import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Account } from './account.entity.js';

/**
 * The provider-expense-specific details of an {@link Account} of type
 * `provider_expense` (see `docs/agents/modules/bank/provider-expense.md`).
 * Owns table `bank_provider_expense_details`, 1:1 with `bank_accounts`:
 * `accountId` is both the primary key and a real FK (`ON DELETE CASCADE`). It
 * never stores an owner: it inherits it through its account. The schedule
 * lives on the provider's bills (see `provider-bill.entity.ts`).
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

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
