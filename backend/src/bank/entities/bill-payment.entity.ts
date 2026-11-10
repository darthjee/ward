import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from './bigint.transformer.js';

/** The outcome recorded for an occurrence. */
export type BillPaymentStatus = 'paid' | 'skipped';

/**
 * The payment (or skip) of one bill occurrence (see
 * `docs/agents/specs/banking/bills.md`, *Payment row*). Owns table
 * `bank_bill_payments`. Keyed by the occurrence's **nominal** `dueDate`;
 * `billId` is set for one-offs only. It never stores an owner: it inherits it
 * through its source account. The generated `derived_due_date` column (the
 * derived-occurrence unique key) is deliberately not mapped, so TypeORM never
 * writes to it.
 */
@Entity('bank_bill_payments')
export class BillPayment {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'source_account_id', type: 'int' })
    sourceAccountId!: number;

  @Column({ name: 'bill_id', type: 'int', nullable: true })
    billId!: number | null;

  /** `YYYY-MM-DD`, the nominal due date. */
  @Column({ name: 'due_date', type: 'date' })
    dueDate!: string;

  @Column({ type: 'varchar', length: 16 })
    status!: BillPaymentStatus;

  /** `YYYY-MM-DD`; `paid` only. */
  @Column({ name: 'paid_on', type: 'date', nullable: true })
    paidOn!: string | null;

  /** Integer minor units of the source account's currency; `paid` only. */
  @Column({ type: 'bigint', nullable: true, transformer: bigintTransformer })
    amount!: bigint | null;

  @Column({ name: 'paying_account_id', type: 'int', nullable: true })
    payingAccountId!: number | null;

  @Column({ name: 'payment_transaction_id', type: 'int', nullable: true })
    paymentTransactionId!: number | null;

  @Column({ name: 'withdrawal_transaction_id', type: 'int', nullable: true })
    withdrawalTransactionId!: number | null;

  @Column({ name: 'charge_transaction_id', type: 'int', nullable: true })
    chargeTransactionId!: number | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
