import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from './bigint.transformer.js';

/**
 * A statement checkpoint of an account (see `docs/agents/specs/reconciliation/model.md`). Owns table
 * `bank_reconciliations`. It never stores an owner: it inherits it through its account. `accountId`
 * is a real FK (`ON DELETE CASCADE`), declared in the migration only.
 *
 * There is no status column: a statement is `open` while `reconciledAt` is `null` and `reconciled`
 * once it is set. The generated `open_key` column (the account id while open, `NULL` once reconciled,
 * under a unique index so an account has at most one open statement) is deliberately not mapped, so
 * TypeORM never writes to it.
 */
@Entity('bank_reconciliations')
export class Reconciliation {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'account_id', type: 'int' })
    accountId!: number;

  /** `YYYY-MM-DD`. */
  @Column({ name: 'statement_date', type: 'date' })
    statementDate!: string;

  /** Signed integer minor units of the account's currency. */
  @Column({ name: 'statement_balance', type: 'bigint', transformer: bigintTransformer })
    statementBalance!: bigint;

  /** When the statement was reconciled; `null` while it is still open. */
  @Column({ name: 'reconciled_at', type: 'datetime', nullable: true })
    reconciledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
