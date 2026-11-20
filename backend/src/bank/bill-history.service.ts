import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type FindOptionsWhere, type Repository } from 'typeorm';
import { accountRefsById } from './account-refs.js';
import type { BillSource } from './bill-schedule.js';
import { BillSourceResolver } from './bill-source.resolver.js';
import type { OwnerContext } from '../core/owner-context.js';
import { Account } from './entities/account.entity.js';
import { BillPayment } from './entities/bill-payment.entity.js';
import { ProviderBill } from './entities/provider-bill.entity.js';
import { isNominalOccurrence } from './occurrence-generator.js';
import { serializePayment, type PaymentResponse } from './occurrence-response.js';
import { buildPagination, LEDGER_PER_PAGE, type Pagination } from './pagination.js';
import { ProviderBillResolver } from './provider-bill.resolver.js';
import { providerBillSchedule } from './provider-bill.schedule.js';

/**
 * One row of the bill history: the occurrence's payment shape
 * (`id`, `status`, `paid_on`, `amount`, `paying_account`) plus `due_date`
 * (nominal), `bill` and `off_schedule`.
 */
export interface BillHistoryRow extends PaymentResponse {
  due_date: string;
  /** The one-off bill of the row; `null` for derived rows. */
  bill: { id: number; description: string } | null;
  /** The provider bill (recurring or one-off) of the row; `null` for debt and orphan rows. */
  source_bill: { id: number; description: string } | null;
  /** `true` for a derived row whose `due_date` is not on its schedule (the bill's own, for recurring bills). */
  off_schedule: boolean;
}

/** The envelope of `GET <base>/accounts/:accountId/bill-payments.json`. */
export interface BillHistoryResponse {
  payments: BillHistoryRow[];
  pagination: Pagination;
}

/**
 * The bill history of a debt account, or of one provider bill (lazy
 * `BankModule`): every payment row — derived (including
 * off-schedule ones) and one-off — newest `due_date` first, then newest id;
 * 50 per page. Like the ledger, an archived account's history stays readable.
 */
@Injectable()
export class BillHistoryService {
  private readonly paymentRepository: Repository<BillPayment>;
  private readonly billRepository: Repository<ProviderBill>;
  private readonly sources: BillSourceResolver;
  private readonly resolver: ProviderBillResolver;

  /**
   * @param {Repository<BillPayment>} paymentRepository - The bill payment repository.
   * @param {Repository<ProviderBill>} billRepository - The provider bill repository.
   * @param {BillSourceResolver} sources - Resolves path bill sources.
   * @param {ProviderBillResolver} resolver - Resolves path provider bills.
   */
  constructor(
    @InjectRepository(BillPayment) paymentRepository: Repository<BillPayment>,
    @InjectRepository(ProviderBill) billRepository: Repository<ProviderBill>,
      sources: BillSourceResolver,
      resolver: ProviderBillResolver,
  ) {
    this.paymentRepository = paymentRepository;
    this.billRepository = billRepository;
    this.sources = sources;
    this.resolver = resolver;
  }

  /**
   * The account-wide history of a debt: every payment row of the account. Providers list
   * their history per bill ({@link historyForBill}).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The debt account.
   * @param {number} page - The 1-based page.
   * @returns {Promise<BillHistoryResponse>} `{ payments, pagination }` (empty past the last page).
   * @throws {NotFoundException} The uniform 404 for a foreign or non-debt account (providers included).
   */
  async history(owner: OwnerContext, accountId: number, page: number): Promise<BillHistoryResponse> {
    const source = await this.sources.resolve(owner, accountId);

    return this.#page({ sourceAccountId: source.account.id }, source.account, source, page);
  }

  /**
   * The history of one provider bill (archived providers allowed).
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} id - The bill id.
   * @param {number} page - The 1-based page.
   * @returns {Promise<BillHistoryResponse>} `{ payments, pagination }` (empty past the last page).
   * @throws {NotFoundException} The uniform 404.
   */
  async historyForBill(owner: OwnerContext, id: number, page: number): Promise<BillHistoryResponse> {
    const { bill, provider } = await this.resolver.peek(owner, id, undefined, { allowArchived: true });
    const where = bill.kind === 'recurring' ? { providerBillId: bill.id } : { billId: bill.id };

    return this.#page(where, provider, null, page);
  }

  async #page(where: FindOptionsWhere<BillPayment>, account: Account, source: BillSource | null, page: number): Promise<BillHistoryResponse> {
    const [payments, total] = await this.paymentRepository.findAndCount({
      where,
      order: { dueDate: 'DESC', id: 'DESC' },
      skip: (page - 1) * LEDGER_PER_PAGE,
      take: LEDGER_PER_PAGE,
    });
    const billIds = [...new Set(payments.flatMap(({ billId, providerBillId }) => [billId, providerBillId ?? null]
      .filter((id): id is number => id !== null)))];
    const found = billIds.length === 0 ? [] : await this.billRepository.find({ where: { id: In(billIds) } });
    const bills = new Map(found.map((bill) => [bill.id, bill]));
    const refs = await accountRefsById(payments.map(({ payingAccountId }) => payingAccountId), this.paymentRepository.manager);

    return {
      payments: payments.map((payment) => {
        const owning = payment.billId ?? payment.providerBillId ?? null;
        const bill = owning === null ? undefined : bills.get(owning);
        const description = bill?.description ?? '';

        return {
          ...serializePayment(payment, account.currency, refs),
          due_date: payment.dueDate,
          bill: payment.billId === null ? null : { id: payment.billId, description },
          source_bill: owning === null ? null : { id: owning, description },
          off_schedule: offSchedule(payment, bill, account, source),
        };
      }),
      pagination: buildPagination(page, LEDGER_PER_PAGE, total),
    };
  }
}

/**
 * @param {BillPayment} payment - A payment row.
 * @param {ProviderBill | undefined} bill - Its provider bill, if it has one.
 * @param {Account} account - The row's source account.
 * @param {BillSource | null} source - The debt source, for the account-wide history.
 * @returns {boolean} Whether the row is derived and off its schedule.
 */
function offSchedule(payment: BillPayment, bill: ProviderBill | undefined, account: Account, source: BillSource | null): boolean {
  if (payment.billId !== null) {
    return false;
  }

  if (payment.providerBillId !== null && payment.providerBillId !== undefined) {
    const schedule = bill ? providerBillSchedule(bill, account) : null;

    return schedule !== null && !isNominalOccurrence({ ...schedule, archived: false, showInCalendar: true }, payment.dueDate);
  }

  return source !== null && !onSchedule(source, payment.dueDate);
}

/**
 * Whether a date matches the account's current schedule pattern (`dueDay`,
 * `dueMonth`, frequency, `billsFrom`). Archiving and `show_in_calendar` hide
 * occurrences but do not move them, so they do not make a payment off-schedule.
 * @param {BillSource} source - The account and its schedule.
 * @param {string} date - A payment's nominal due date.
 * @returns {boolean} Whether `date` is a nominal occurrence of the current schedule.
 */
function onSchedule(source: BillSource, date: string): boolean {
  return isNominalOccurrence({ ...source.schedule, archived: false, showInCalendar: true }, date);
}
