import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { accountRefsById } from './account-refs.js';
import { undoPayment } from './bill-payment-undo.js';
import { BillPaymentWriter, type PaymentTarget } from './bill-payment.writer.js';
import { billSourceOfProviderBill } from './bill-schedule.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import type { PayOccurrenceDto } from './dto/pay-occurrence.dto.js';
import { Account } from './entities/account.entity.js';
import type { BillPayment } from './entities/bill-payment.entity.js';
import { isIsoDate, todayUtc } from './ledger-date.js';
import { shiftWeekend } from './occurrence-generator.js';
import { billInput, buildOccurrence, derivedInput, type OccurrenceInput, type OccurrenceResponse } from './occurrence-response.js';
import { PayingAccountResolver } from './paying-account.resolver.js';
import { paymentCommand } from './payment-body.js';
import { ProviderBillResolver, type ResolvedProviderBill } from './provider-bill.resolver.js';
import { isProviderBillOccurrence } from './provider-bill.schedule.js';

/**
 * Pay, skip and undo of the occurrences of one provider bill, recurring or
 * one-off (lazy `BankModule`, see `docs/agents/modules/bank/bills.md`). The
 * account-level provider routes delegate here. Path ids answer the uniform
 * 404; body account ids the generic 422; the writes are atomic and locked per
 * bill (see {@link BillPaymentWriter}).
 */
@Injectable()
export class ProviderBillPaymentService {
  private readonly accountRepository: Repository<Account>;
  private readonly resolver: ProviderBillResolver;
  private readonly payingAccounts: PayingAccountResolver;
  private readonly writer: BillPaymentWriter;

  /**
   * @param {Repository<Account>} accountRepository - The account repository.
   * @param {ProviderBillResolver} resolver - Resolves bills and providers owner-scoped.
   * @param {PayingAccountResolver} payingAccounts - Resolves body paying accounts.
   * @param {BillPaymentWriter} writer - The atomic payment writes.
   */
  constructor(
    @InjectRepository(Account) accountRepository: Repository<Account>,
      resolver: ProviderBillResolver,
      payingAccounts: PayingAccountResolver,
      writer: BillPaymentWriter,
  ) {
    this.accountRepository = accountRepository;
    this.resolver = resolver;
    this.payingAccounts = payingAccounts;
    this.writer = writer;
  }

  /**
   * Pays or skips an occurrence of a bill (checks: 404, 404, 400, 422, 409).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @param {string} dueDate - The raw nominal due date.
   * @param {PayOccurrenceDto} dto - The validated body.
   * @returns {Promise<OccurrenceResponse>} The updated occurrence.
   * @throws {NotFoundException} 404 for a foreign bill, an archived provider or a date that is not an occurrence.
   * @throws {ConflictException} 409 when already paid or skipped.
   */
  async pay(owner: OwnerContext, id: number, dueDate: string, dto: PayOccurrenceDto): Promise<OccurrenceResponse> {
    const { bill, provider } = await this.resolver.peek(owner, id);

    if (!isIsoDate(dueDate) || !isProviderBillOccurrence(bill, provider, dueDate)) {
      throw ownerNotFound();
    }

    const recurring = bill.kind === 'recurring';
    const target: PaymentTarget = {
      sourceAccountId: provider.id,
      billId: recurring ? null : bill.id,
      providerBillId: recurring ? bill.id : null,
      nominal: dueDate,
      label: bill.description,
      currency: provider.currency,
    };
    const command = paymentCommand(dto, recurring ? 'provider' : 'bill', provider.currency);

    if (command.status === 'paid') {
      await this.payingAccounts.resolve(owner, command.payingAccountId, provider.currency);
    }

    const payment = await this.writer.record(owner, target, command);

    return this.#respond({ bill, provider }, dueDate, payment);
  }

  /**
   * Undoes the payment or skip of an occurrence of a bill. The date need not
   * be on the schedule any more (#56), and an archived provider is allowed.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @param {string} dueDate - The raw nominal due date.
   * @returns {Promise<void>}
   * @throws {NotFoundException} 404 (unknown bill, bad date, no row, or a skip on an archived provider).
   * @throws {ConflictException} 409 `ACCOUNT_ARCHIVED` for a paid row with an archived source or paying account.
   */
  async undo(owner: OwnerContext, id: number, dueDate: string): Promise<void> {
    const { bill, provider } = await this.resolver.peek(owner, id, undefined, { allowArchived: true });

    if (!isIsoDate(dueDate)) {
      throw ownerNotFound();
    }

    const recurring = bill.kind === 'recurring';
    const found = await this.writer.find({
      sourceAccountId: provider.id,
      billId: recurring ? null : bill.id,
      providerBillId: recurring ? bill.id : null,
      nominal: dueDate,
    });
    const payment = found && (recurring || found.dueDate === dueDate) ? found : null;

    await undoPayment(this.writer, this.accountRepository, provider, payment);
  }

  async #respond({ bill, provider }: ResolvedProviderBill, dueDate: string, payment: BillPayment): Promise<OccurrenceResponse> {
    const refs = await accountRefsById([bill.payingAccountId, payment.payingAccountId], this.accountRepository.manager);
    const input: OccurrenceInput = bill.kind === 'recurring'
      ? derivedInput(
        billSourceOfProviderBill(bill, provider, bill.payingAccountId === null ? null : refs.get(bill.payingAccountId) ?? null),
        { nominal: dueDate, effective: shiftWeekend(dueDate) },
        payment,
      )
      : billInput(bill, provider, payment, refs);

    return buildOccurrence(input, refs, todayUtc(new Date())).response;
  }
}
