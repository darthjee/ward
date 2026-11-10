import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { accountArchived } from './account-conflicts.js';
import { accountOwnerWhere } from './account-fields.js';
import { accountRefsById } from './account-refs.js';
import { AccountTypeRegistry } from './account-types/account-type.registry.js';
import { BillPaymentWriter, type PaymentTarget } from './bill-payment.writer.js';
import { BILL_SOURCE_TYPES, billSourceOf, type BillSource } from './bill-schedule.js';
import { BillService } from './bill.service.js';
import { PayingAccountResolver } from './paying-account.resolver.js';
import type { OwnerContext } from '../core/owner-context.js';
import { ownerNotFound } from '../core/parse-id.js';
import type { PayOccurrenceDto } from './dto/pay-occurrence.dto.js';
import { Account } from './entities/account.entity.js';
import type { BillPayment } from './entities/bill-payment.entity.js';
import { isIsoDate, todayUtc } from './ledger-date.js';
import { isNominalOccurrence, shiftWeekend } from './occurrence-generator.js';
import { billInput, buildOccurrence, derivedInput, type OccurrenceInput, type OccurrenceResponse } from './occurrence-response.js';
import { paymentCommand } from './payment-body.js';

/**
 * Pay, skip and undo of bill occurrences (lazy `BankModule`, see
 * `docs/agents/specs/banking/bills.md`, *Paying a bill*). Path ids answer the
 * uniform 404; body account ids the generic 422; the writes are atomic (see
 * {@link BillPaymentWriter}).
 *
 * Undo checks, in order (decided in #56):
 *
 * | # | Check                                                        | Answer |
 * |---|--------------------------------------------------------------|--------|
 * | 1 | `:accountId` not an owned debt / provider (`:id` not an owned bill of an active provider) | 404 |
 * | 2 | `:dueDate` not a `YYYY-MM-DD` date                           | 404 |
 * | 3 | no payment row for the occurrence                            | 404 |
 * | 4 | a skip whose source account is archived                      | 404 |
 * | 5 | a payment whose source account is archived                   | 409 |
 * | 6 | a payment whose paying account is archived                   | 409 |
 *
 * Undo does not require the date to still be on the schedule, so an
 * off-schedule payment can still be undone; pay always requires it.
 */
@Injectable()
export class BillPaymentService {
  private readonly accountRepository: Repository<Account>;
  private readonly registry: AccountTypeRegistry;
  private readonly bills: BillService;
  private readonly payingAccounts: PayingAccountResolver;
  private readonly writer: BillPaymentWriter;

  /**
   * @param {Repository<Account>} accountRepository - The account repository.
   * @param {AccountTypeRegistry} registry - Loads the source accounts' details.
   * @param {BillService} bills - Owner-scoped one-off bill lookups.
   * @param {PayingAccountResolver} payingAccounts - Resolves body paying accounts.
   * @param {BillPaymentWriter} writer - The atomic payment writes.
   */
  constructor(
    @InjectRepository(Account) accountRepository: Repository<Account>,
      registry: AccountTypeRegistry,
      bills: BillService,
      payingAccounts: PayingAccountResolver,
      writer: BillPaymentWriter,
  ) {
    this.accountRepository = accountRepository;
    this.registry = registry;
    this.bills = bills;
    this.payingAccounts = payingAccounts;
    this.writer = writer;
  }

  /**
   * Pays or skips a derived occurrence.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The debt / provider account.
   * @param {string} dueDate - The raw nominal due date.
   * @param {PayOccurrenceDto} dto - The validated body.
   * @returns {Promise<OccurrenceResponse>} The updated occurrence.
   * @throws {NotFoundException} 404 for a foreign account or a date that is not an occurrence.
   * @throws {ConflictException} 409 when already paid or skipped.
   */
  async payOccurrence(owner: OwnerContext, accountId: number, dueDate: string, dto: PayOccurrenceDto): Promise<OccurrenceResponse> {
    const source = await this.#source(owner, accountId);

    if (!isIsoDate(dueDate) || !isNominalOccurrence(source.schedule, dueDate)) {
      throw ownerNotFound();
    }

    const target = { sourceAccountId: source.account.id, billId: null, nominal: dueDate, label: source.account.name };
    const payment = await this.#record(owner, target, dto, source.kind, source.account.currency);

    return this.#respond(derivedInput(source, { nominal: dueDate, effective: shiftWeekend(dueDate) }, payment));
  }

  /**
   * Pays or skips a one-off bill.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @param {PayOccurrenceDto} dto - The validated body.
   * @returns {Promise<OccurrenceResponse>} The updated occurrence.
   * @throws {NotFoundException} 404 for a foreign bill or an archived provider.
   * @throws {ConflictException} 409 when already paid or skipped.
   */
  async payBill(owner: OwnerContext, id: number, dto: PayOccurrenceDto): Promise<OccurrenceResponse> {
    const { bill, provider } = await this.bills.findOwned(owner, id);
    const target = { sourceAccountId: provider.id, billId: bill.id, nominal: bill.dueDate, label: bill.description };
    const payment = await this.#record(owner, target, dto, 'bill', provider.currency);
    const refs = await accountRefsById([bill.payingAccountId, payment.payingAccountId], this.accountRepository.manager);

    return buildOccurrence(billInput(bill, provider, payment, refs), refs, todayUtc(new Date())).response;
  }

  /**
   * Undoes the payment or skip of a derived occurrence (see the checks table).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The debt / provider account.
   * @param {string} dueDate - The raw nominal due date.
   * @returns {Promise<void>}
   * @throws {NotFoundException} 404 (checks 1–4).
   * @throws {ConflictException} 409 on an archived account (checks 5–6).
   */
  async undoOccurrence(owner: OwnerContext, accountId: number, dueDate: string): Promise<void> {
    const account = (await this.#source(owner, accountId)).account;
    const payment = isIsoDate(dueDate) ? await this.writer.find({ sourceAccountId: account.id, billId: null, nominal: dueDate }) : null;

    await this.#undo(account, payment);
  }

  /**
   * Undoes the payment or skip of a one-off bill (see the checks table).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @returns {Promise<void>}
   * @throws {NotFoundException} 404 (checks 1 and 3).
   * @throws {ConflictException} 409 when the paying account is archived (check 6).
   */
  async undoBill(owner: OwnerContext, id: number): Promise<void> {
    const { bill, provider } = await this.bills.findOwned(owner, id);

    await this.#undo(provider, await this.writer.find({ sourceAccountId: provider.id, billId: bill.id, nominal: bill.dueDate }));
  }

  async #source(owner: OwnerContext, accountId: number): Promise<BillSource> {
    const account = await this.accountRepository.findOneBy({ ...accountOwnerWhere(owner), id: accountId });

    if (!account || !BILL_SOURCE_TYPES.includes(account.type)) {
      throw ownerNotFound();
    }

    const details = await this.registry.loadDetails([account], this.accountRepository.manager);

    return billSourceOf(account, details.get(account.id));
  }

  async #record(
    owner: OwnerContext,
    target: PaymentTarget,
    dto: PayOccurrenceDto,
    kind: OccurrenceInput['kind'],
    currency: string,
  ): Promise<BillPayment> {
    const command = paymentCommand(dto, kind, currency);

    if (command.status === 'paid') {
      await this.payingAccounts.resolve(owner, command.payingAccountId, currency);
    }

    return this.writer.record(target, command);
  }

  async #undo(source: Account, payment: BillPayment | null): Promise<void> {
    if (!payment || (payment.status === 'skipped' && source.archivedAt)) {
      throw ownerNotFound();
    }

    if (payment.status === 'paid' && (source.archivedAt || (await this.#payingArchived(payment)))) {
      throw accountArchived();
    }

    await this.writer.remove(payment);
  }

  async #payingArchived(payment: BillPayment): Promise<boolean> {
    if (payment.payingAccountId === null) {
      return false;
    }

    const paying = await this.accountRepository.findOneBy({ id: payment.payingAccountId });

    return Boolean(paying?.archivedAt);
  }

  async #respond(input: OccurrenceInput): Promise<OccurrenceResponse> {
    const refs = await accountRefsById([input.payment?.payingAccountId ?? null], this.accountRepository.manager);

    return buildOccurrence(input, refs, todayUtc(new Date())).response;
  }
}
