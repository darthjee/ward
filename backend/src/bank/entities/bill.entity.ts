import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from './bigint.transformer.js';

/**
 * A one-off bill (see `docs/agents/modules/bank/bills.md`, *One-off bills*).
 * Owns table `bank_bills`. It never stores an owner: it inherits it through
 * its provider-expense account (`providerAccountId`, a real FK
 * `ON DELETE CASCADE`). `payingAccountId` is a real FK `ON DELETE SET NULL`.
 */
@Entity('bank_bills')
export class Bill {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'provider_account_id', type: 'int' })
    providerAccountId!: number;

  @Column({ name: 'paying_account_id', type: 'int', nullable: true })
    payingAccountId!: number | null;

  /** `YYYY-MM-DD`; no weekend shift (nominal and effective date). */
  @Column({ name: 'due_date', type: 'date' })
    dueDate!: string;

  /** Integer minor units of the provider account's currency; > 0. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
    amount!: bigint;

  @Column({ type: 'varchar', length: 255 })
    description!: string;

  @Column({ type: 'text', nullable: true })
    notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
