import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from './bigint.transformer.js';

/** `recurring` bills carry a schedule; `one_off` bills carry a `dueDate`. */
export type ProviderBillKind = 'recurring' | 'one_off';

/**
 * A provider bill (see `docs/agents/modules/bank/bills.md`). Owns table
 * `bank_provider_bills`. It never stores an owner: it inherits it through its
 * provider-expense account (`providerAccountId`, a real FK `ON DELETE
 * CASCADE`). `payingAccountId` is a real FK `ON DELETE SET NULL`. One-off bills
 * use `dueDate`; recurring bills use the schedule columns. The generated
 * `recurring_description` column (the recurring unique key) is deliberately
 * not mapped.
 */
@Entity('bank_provider_bills')
export class ProviderBill {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'provider_account_id', type: 'int' })
    providerAccountId!: number;

  @Column({ name: 'paying_account_id', type: 'int', nullable: true })
    payingAccountId!: number | null;

  @Column({ type: 'varchar', length: 16, default: 'one_off' })
    kind!: ProviderBillKind;

  /** `YYYY-MM-DD`; no weekend shift (nominal and effective date). One-off only. */
  @Column({ name: 'due_date', type: 'date', nullable: true })
    dueDate!: string | null;

  /** Integer minor units of the provider account's currency; > 0 for one-offs. */
  @Column({ name: 'expected_amount', type: 'bigint', nullable: true, transformer: bigintTransformer })
    expectedAmount!: bigint | null;

  @Column({ type: 'varchar', length: 255 })
    description!: string;

  @Column({ type: 'text', nullable: true })
    notes!: string | null;

  @Column({ name: 'charge_frequency', type: 'varchar', length: 16, nullable: true })
    chargeFrequency!: string | null;

  @Column({ name: 'due_day', type: 'tinyint', nullable: true })
    dueDay!: number | null;

  @Column({ name: 'due_month', type: 'tinyint', nullable: true })
    dueMonth!: number | null;

  @Column({ name: 'bills_from', type: 'date', nullable: true })
    billsFrom!: string | null;

  @Column({ name: 'show_in_calendar', type: 'boolean', nullable: true })
    showInCalendar!: boolean | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
