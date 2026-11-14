import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from './bigint.transformer.js';

/**
 * A bank account of any type (see `docs/agents/modules/bank/accounts.md`).
 * Owns table `bank_accounts`. Exactly one of `userId` / `organizationId` is
 * set (DB check); both are logical references to `auth` (no FK) and their
 * property names are relied on by `ownerWhere()`. Neither is ever returned in
 * a response. The generated `active_name_key` column (per-owner,
 * case-insensitive name uniqueness among active accounts) is deliberately not
 * mapped, so TypeORM never writes to it.
 */
@Entity('bank_accounts')
export class Account {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
    userId!: number | null;

  @Column({ name: 'organization_id', type: 'int', nullable: true })
    organizationId!: number | null;

  @Column({ type: 'varchar', length: 32 })
    type!: string;

  @Column({ type: 'varchar', length: 255 })
    name!: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 64, nullable: true })
    bankName!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
    branch!: string | null;

  @Column({ name: 'account_number', type: 'varchar', length: 64, nullable: true })
    accountNumber!: string | null;

  @Column({ type: 'char', length: 3 })
    currency!: string;

  /** `YYYY-MM-DD`; the balance was `openingBalance` at the start of this day. */
  @Column({ name: 'opening_date', type: 'date' })
    openingDate!: string;

  /** Integer minor units of `currency`. */
  @Column({ name: 'opening_balance', type: 'bigint', default: 0, transformer: bigintTransformer })
    openingBalance!: bigint;

  @Column({ name: 'archived_at', type: 'datetime', nullable: true })
    archivedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
    notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
