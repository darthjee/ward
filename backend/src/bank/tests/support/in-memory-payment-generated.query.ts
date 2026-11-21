import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { InMemoryBankRepo } from './in-memory-bank-repos.js';
import type { OwnerScope } from '../../../core/owner-context.js';
import { Account } from '../../entities/account.entity.js';
import { BillPayment } from '../../entities/bill-payment.entity.js';

// TypeScript stand-in for the owner-scoped EXISTS of `PaymentGeneratedQuery` (raw SQL the
// in-memory repositories cannot run). Specs swap it in with `jest.mock(...)` (same class name and
// constructor injection) or construct it directly. Like the SQL, a payment counts only when its
// source account belongs to the owner. The real SQL is covered by
// `payment-generated.integration-spec.ts`.

const REFS = ['paymentTransactionId', 'withdrawalTransactionId', 'chargeTransactionId'] as const;

@Injectable()
export class PaymentGeneratedQuery {
  static calls = 0;
  private readonly billPayments: InMemoryBankRepo<BillPayment>;
  private readonly accounts: InMemoryBankRepo<Account>;

  constructor(
    @InjectRepository(BillPayment) billPayments: InMemoryBankRepo<BillPayment>,
    @InjectRepository(Account) accounts: InMemoryBankRepo<Account>,
  ) {
    this.billPayments = billPayments;
    this.accounts = accounts;
  }

  async isPaymentGenerated(owner: OwnerScope, transactionId: number): Promise<boolean> {
    PaymentGeneratedQuery.calls++;
    const ownedBy = (account: Account): boolean => owner.kind === 'user'
      ? account.userId === owner.userId && account.organizationId === null
      : account.userId === null && account.organizationId === owner.organizationId;
    const owned = new Set(this.accounts.rows.filter(ownedBy).map((account) => account.id));

    return this.billPayments.rows.some((payment) =>
      owned.has(payment.sourceAccountId) && REFS.some((ref) => payment[ref] === transactionId));
  }
}
