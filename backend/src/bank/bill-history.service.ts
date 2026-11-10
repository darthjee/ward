import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { accountRefsById } from './account-refs.js';
import type { BillSource } from './bill-schedule.js';
import { BillSourceResolver } from './bill-source.resolver.js';
import type { OwnerContext } from '../core/owner-context.js';
import { BillPayment } from './entities/bill-payment.entity.js';
import { Bill } from './entities/bill.entity.js';
import { isNominalOccurrence } from './occurrence-generator.js';
import { serializePayment, type PaymentResponse } from './occurrence-response.js';
import { buildPagination, LEDGER_PER_PAGE, type Pagination } from './pagination.js';

/**
 * One row of the bill history: the occurrence's payment shape
 * (`id`, `status`, `paid_on`, `amount`, `paying_account`) plus `due_date`
 * (nominal), `bill` and `off_schedule`.
 */
export interface BillHistoryRow extends PaymentResponse {
  due_date: string;
  bill: { id: number; description: string } | null;
  /** `true` for a derived row whose `due_date` is not on the account's current schedule. */
  off_schedule: boolean;
}

/** The envelope of `GET <base>/accounts/:accountId/bill-payments.json`. */
export interface BillHistoryResponse {
  payments: BillHistoryRow[];
  pagination: Pagination;
}

/**
 * The bill history of a debt / provider-expense account (lazy `BankModule`):
 * every payment row of the account — derived (including off-schedule ones)
 * and one-off — newest `due_date` first, then newest id; 50 per page. Like
 * the ledger, an archived account's history stays readable.
 */
@Injectable()
export class BillHistoryService {
  private readonly paymentRepository: Repository<BillPayment>;
  private readonly billRepository: Repository<Bill>;
  private readonly sources: BillSourceResolver;

  /**
   * @param {Repository<BillPayment>} paymentRepository - The bill payment repository.
   * @param {Repository<Bill>} billRepository - The one-off bill repository.
   * @param {BillSourceResolver} sources - Resolves path bill sources.
   */
  constructor(
    @InjectRepository(BillPayment) paymentRepository: Repository<BillPayment>,
    @InjectRepository(Bill) billRepository: Repository<Bill>,
      sources: BillSourceResolver,
  ) {
    this.paymentRepository = paymentRepository;
    this.billRepository = billRepository;
    this.sources = sources;
  }

  /**
   * @param {OwnerContext} owner - The resolved owner.
   * @param {number} accountId - The debt / provider account.
   * @param {number} page - The 1-based page.
   * @returns {Promise<BillHistoryResponse>} `{ payments, pagination }` (empty past the last page).
   * @throws {NotFoundException} The uniform 404 for a foreign or non-debt / non-provider account.
   */
  async history(owner: OwnerContext, accountId: number, page: number): Promise<BillHistoryResponse> {
    const source = await this.sources.resolve(owner, accountId);
    const [payments, total] = await this.paymentRepository.findAndCount({
      where: { sourceAccountId: source.account.id },
      order: { dueDate: 'DESC', id: 'DESC' },
      skip: (page - 1) * LEDGER_PER_PAGE,
      take: LEDGER_PER_PAGE,
    });
    const billIds = payments.flatMap(({ billId }) => (billId === null ? [] : [billId]));
    const bills = billIds.length === 0 ? [] : await this.billRepository.find({ where: { id: In(billIds) } });
    const descriptions = new Map(bills.map((bill) => [bill.id, bill.description]));
    const refs = await accountRefsById(payments.map(({ payingAccountId }) => payingAccountId), this.paymentRepository.manager);

    return {
      payments: payments.map((payment) => ({
        ...serializePayment(payment, source.account.currency, refs),
        due_date: payment.dueDate,
        bill: payment.billId === null ? null : { id: payment.billId, description: descriptions.get(payment.billId) ?? '' },
        off_schedule: payment.billId === null && !onSchedule(source, payment.dueDate),
      })),
      pagination: buildPagination(page, LEDGER_PER_PAGE, total),
    };
  }
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
