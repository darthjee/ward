import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, type FindOperator, type FindOptionsWhere, type Repository } from 'typeorm';
import { accountOwnerWhere } from './account-fields.js';
import { accountRefsById, type AccountRef } from './account-refs.js';
import { AccountTypeRegistry } from './account-types/account-type.registry.js';
import { BILL_SOURCE_TYPES, billSourceOf, PROVIDER_TYPE, type BillSource } from './bill-schedule.js';
import type { OwnerContext } from '../core/owner-context.js';
import { Account } from './entities/account.entity.js';
import { BillPayment } from './entities/bill-payment.entity.js';
import { Bill } from './entities/bill.entity.js';

/** The owner's active bill sources. */
export interface CalendarSources {
  /** Debt / provider accounts with a schedule (`dueDay` set, shown in the Calendar). */
  scheduled: BillSource[];
  /** Every active provider-expense account (the owners of one-off bills), by id. */
  providers: Map<number, Account>;
}

/**
 * The reads behind the Calendar routes (lazy `BankModule`). Every read is
 * scoped to the owner through its accounts: the accounts query uses
 * `accountOwnerWhere`, and bills / payments are only read for those account
 * ids. Archived accounts are excluded, so their occurrences (and their
 * one-off bills) disappear and reappear on unarchive.
 */
@Injectable()
export class CalendarQuery {
  private readonly accountRepository: Repository<Account>;
  private readonly billRepository: Repository<Bill>;
  private readonly paymentRepository: Repository<BillPayment>;
  private readonly registry: AccountTypeRegistry;

  /**
   * @param {Repository<Account>} accountRepository - The account repository.
   * @param {Repository<Bill>} billRepository - The one-off bill repository.
   * @param {Repository<BillPayment>} paymentRepository - The bill payment repository.
   * @param {AccountTypeRegistry} registry - Loads the accounts' details.
   */
  constructor(
    @InjectRepository(Account) accountRepository: Repository<Account>,
    @InjectRepository(Bill) billRepository: Repository<Bill>,
    @InjectRepository(BillPayment) paymentRepository: Repository<BillPayment>,
      registry: AccountTypeRegistry,
  ) {
    this.accountRepository = accountRepository;
    this.billRepository = billRepository;
    this.paymentRepository = paymentRepository;
    this.registry = registry;
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @returns {Promise<CalendarSources>} The owner's active debt / provider accounts.
   */
  async sources(owner: OwnerContext): Promise<CalendarSources> {
    const accounts = await this.accountRepository.find({
      where: { ...accountOwnerWhere(owner), type: In(BILL_SOURCE_TYPES), archivedAt: IsNull() },
    });
    const details = await this.registry.loadDetails(accounts, this.accountRepository.manager);
    const sources = accounts.map((account) => billSourceOf(account, details.get(account.id)));

    return {
      scheduled: sources.filter(({ schedule }) => schedule.dueDay !== null && schedule.showInCalendar),
      providers: new Map(accounts.filter(({ type }) => type === PROVIDER_TYPE).map((account) => [account.id, account])),
    };
  }

  /**
   * @param {number[]} providerIds - The owner's active provider accounts.
   * @param {FindOperator<string>} dueDate - The `due_date` filter.
   * @returns {Promise<Bill[]>} Their one-off bills due in the range.
   */
  async bills(providerIds: number[], dueDate: FindOperator<string>): Promise<Bill[]> {
    if (providerIds.length === 0) {
      return [];
    }

    return this.billRepository.find({ where: { providerAccountId: In(providerIds), dueDate } });
  }

  /**
   * @param {number[]} sourceIds - Scheduled accounts whose derived payments to read.
   * @param {number[]} billIds - One-off bills whose payment to read.
   * @param {FindOperator<string>} dueDate - The derived payments' nominal `due_date` filter.
   * @returns {Promise<BillPayment[]>} The payment rows.
   */
  async payments(sourceIds: number[], billIds: number[], dueDate: FindOperator<string>): Promise<BillPayment[]> {
    const where: Array<FindOptionsWhere<BillPayment>> = [];

    if (sourceIds.length > 0) {
      where.push({ sourceAccountId: In(sourceIds), billId: IsNull(), dueDate });
    }

    if (billIds.length > 0) {
      where.push({ billId: In(billIds) });
    }

    return where.length === 0 ? [] : this.paymentRepository.find({ where });
  }

  /**
   * @param {Array<number | null>} ids - Account ids (paying accounts of the owner's rows).
   * @returns {Promise<Map<number, AccountRef>>} Their id and name.
   */
  async refs(ids: Array<number | null>): Promise<Map<number, AccountRef>> {
    return accountRefsById(ids, this.accountRepository.manager);
  }
}
