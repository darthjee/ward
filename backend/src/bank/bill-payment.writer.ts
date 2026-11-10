import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type EntityManager, type Repository } from 'typeorm';
import { occurrenceAlreadyPaid } from './bill-conflicts.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import { BillPayment } from './entities/bill-payment.entity.js';
import { Bill } from './entities/bill.entity.js';
import { Transaction } from './entities/transaction.entity.js';
import { isMysqlError, MYSQL_DUPLICATE_ENTRY } from './mysql-errors.js';
import { PayingAccountResolver } from './paying-account.resolver.js';
import type { PaymentCommand } from './payment-body.js';
import { paymentDescription } from './payment-description.js';

/** The occurrence a payment is recorded for. */
export interface PaymentTarget {
  /** The debt / provider account (a one-off's provider). */
  sourceAccountId: number;
  /** Set for one-off bills only. */
  billId: number | null;
  /** The nominal due date (the payment key of a derived occurrence). */
  nominal: string;
  /** The bill description, or the source account's name (for the transactions' description). */
  label: string;
  /** The source account's currency (the paying account must match it). */
  currency: string;
}

/**
 * The atomic writes of a bill payment (lazy `BankModule`): the
 * `bank_bill_payments` row and the ledger transactions it creates are written
 * — and undone — in **one** DB transaction, so a failure saves none of them.
 * The ledger entries are ordinary transactions: a provider charge (negative,
 * unsent) feeds the accountant hand-off like any hand-entered charge.
 *
 * The caller's checks run before the transaction (for the public check
 * order); the ones a concurrent request could invalidate are repeated inside
 * it, under row locks: a one-off bill is locked `FOR UPDATE` (the same lock
 * `BillService` takes to edit / delete it, so the two serialize) and the
 * paying account is share-locked while it is re-validated.
 */
@Injectable()
export class BillPaymentWriter {
  private readonly paymentRepository: Repository<BillPayment>;
  private readonly payingAccounts: PayingAccountResolver;

  /**
   * @param {Repository<BillPayment>} paymentRepository - The bill payment repository.
   * @param {PayingAccountResolver} payingAccounts - Re-validates the paying account inside the transaction.
   */
  constructor(
  @InjectRepository(BillPayment) paymentRepository: Repository<BillPayment>,
    payingAccounts: PayingAccountResolver,
  ) {
    this.paymentRepository = paymentRepository;
    this.payingAccounts = payingAccounts;
  }

  /**
   * @param {PaymentTarget} target - The occurrence.
   * @returns {Promise<BillPayment | null>} Its payment row, if any.
   */
  async find(target: Pick<PaymentTarget, 'sourceAccountId' | 'billId' | 'nominal'>): Promise<BillPayment | null> {
    return this.paymentRepository.findOneBy(
      target.billId === null
        ? { sourceAccountId: target.sourceAccountId, billId: IsNull(), dueDate: target.nominal }
        : { billId: target.billId },
    );
  }

  /**
   * Records a payment or a skip. `paid` writes a payment (+) on the source
   * account, a withdrawal (−) on the paying account and, when asked, a charge
   * (−) on the source, all dated `paid_on`; `skipped` writes only the row.
   * @param {OwnerContext} owner - The resolved owner (for the paying-account re-check).
   * @param {PaymentTarget} target - The occurrence.
   * @param {PaymentCommand} command - The validated request.
   * @returns {Promise<BillPayment>} The new payment row.
   * @throws {NotFoundException} 404 when the one-off bill is gone (or moved) by the time of the write.
   * @throws {UnprocessableEntityException} 422 when the paying account no longer qualifies (e.g. archived meanwhile).
   * @throws {ConflictException} 409 when the occurrence already has a payment (also on a race).
   */
  async record(owner: OwnerContext, target: PaymentTarget, command: PaymentCommand): Promise<BillPayment> {
    if (await this.find(target)) {
      throw occurrenceAlreadyPaid();
    }

    try {
      return await this.paymentRepository.manager.transaction(async (manager) => {
        await this.#recheck(manager, owner, target, command);
        return this.#write(manager, target, command);
      });
    } catch (error) {
      if (isMysqlError(error, MYSQL_DUPLICATE_ENTRY)) {
        throw occurrenceAlreadyPaid();
      }

      throw error;
    }
  }

  /**
   * Undoes a payment: deletes the transactions it created that still exist
   * (even a charge already sent to the accountant), then the row.
   * @param {BillPayment} payment - The payment row.
   * @returns {Promise<void>}
   */
  async remove(payment: BillPayment): Promise<void> {
    const ids = [payment.paymentTransactionId, payment.withdrawalTransactionId, payment.chargeTransactionId]
      .filter((id): id is number => id !== null);

    await this.paymentRepository.manager.transaction(async (manager) => {
      if (ids.length > 0) {
        await manager.getRepository(Transaction).delete({ id: In(ids) });
      }

      await manager.getRepository(BillPayment).delete({ id: payment.id });
    });
  }

  async #recheck(manager: EntityManager, owner: OwnerContext, target: PaymentTarget, command: PaymentCommand): Promise<void> {
    if (target.billId !== null) {
      const bill = await manager.getRepository(Bill).findOne({
        where: { id: target.billId, providerAccountId: target.sourceAccountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!bill) {
        throw ownerNotFound();
      }
    }

    if (command.status === 'paid') {
      await this.payingAccounts.resolve(owner, command.payingAccountId, target.currency, manager);
    }
  }

  async #write(manager: EntityManager, target: PaymentTarget, command: PaymentCommand): Promise<BillPayment> {
    const payments = manager.getRepository(BillPayment);
    const row = payments.create({
      sourceAccountId: target.sourceAccountId,
      billId: target.billId,
      dueDate: target.nominal,
      status: command.status,
      paidOn: null,
      amount: null,
      payingAccountId: null,
      paymentTransactionId: null,
      withdrawalTransactionId: null,
      chargeTransactionId: null,
    });

    if (command.status === 'paid') {
      const entry = this.#entryWriter(manager, command.paidOn, paymentDescription(target.label, target.nominal));
      Object.assign(row, {
        paidOn: command.paidOn,
        amount: command.amount,
        payingAccountId: command.payingAccountId,
        paymentTransactionId: await entry(target.sourceAccountId, command.amount),
        withdrawalTransactionId: await entry(command.payingAccountId, -command.amount),
        chargeTransactionId: command.recordCharge ? await entry(target.sourceAccountId, -command.amount) : null,
      });
    }

    return payments.save(row);
  }

  #entryWriter(manager: EntityManager, date: string, description: string): (accountId: number, amount: bigint) => Promise<number> {
    const transactions = manager.getRepository(Transaction);

    return async (accountId, amount) => {
      const saved = await transactions.save(transactions.create({
        accountId,
        date,
        amount,
        description,
        notes: null,
        sentToAccountantAt: null,
      }));

      return saved.id;
    };
  }
}
