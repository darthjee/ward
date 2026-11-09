import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from './bigint.transformer.js';

/**
 * A ledger entry of an {@link import('./account.entity.js').Account}. Owns
 * table `bank_transactions`. It never stores an owner: it inherits it through
 * its account. `accountId` is a real FK (`ON DELETE RESTRICT`), declared in
 * the migration only.
 */
@Entity('bank_transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'account_id', type: 'int' })
    accountId!: number;

  /** `YYYY-MM-DD`; never after UTC today + 1 day. */
  @Column({ type: 'date' })
    date!: string;

  /** Signed integer minor units of the account's currency; never zero. */
  @Column({ type: 'bigint', transformer: bigintTransformer })
    amount!: bigint;

  @Column({ type: 'varchar', length: 255 })
    description!: string;

  @Column({ type: 'text', nullable: true })
    notes!: string | null;

  /**
   * Accountant hand-off mark of a provider-expense charge: set only by Mark as sent, cleared by
   * Mark as unsent (or by a PATCH that turns the charge into a payment). `null` when unsent.
   */
  @Column({ name: 'sent_to_accountant_at', type: 'datetime', nullable: true })
    sentToAccountantAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
