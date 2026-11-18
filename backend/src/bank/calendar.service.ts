import { BadRequestException, Injectable } from '@nestjs/common';
import { Between, LessThan, type FindOperator } from 'typeorm';
import type { BillSource } from './bill-schedule.js';
import { calendarTotals, overdueTotals, type CalendarTotal, type OverdueTotal } from './calendar-totals.js';
import { CalendarQuery } from './calendar.query.js';
import { ErrorCodes } from '../core/error-codes.js';
import type { OwnerContext } from '../core/owner-context.js';
import { assertCalendarRange, type CalendarQueryDto } from './dto/calendar-query.dto.js';
import type { Account } from './entities/account.entity.js';
import type { BillPayment } from './entities/bill-payment.entity.js';
import type { ProviderBill } from './entities/provider-bill.entity.js';
import { todayUtc } from './ledger-date.js';
import { addDays, occurrencesBetween, type Occurrence } from './occurrence-generator.js';
import {
  billInput,
  buildOccurrence,
  compareOccurrences,
  derivedInput,
  type OccurrenceResponse,
  type OccurrenceView,
} from './occurrence-response.js';

/** The envelope of `GET <base>/calendar.json`. */
export interface CalendarResponse {
  occurrences: OccurrenceResponse[];
  totals: CalendarTotal[];
}

/** The envelope of `GET <base>/calendar/overdue.json`. */
export interface OverdueResponse {
  occurrences: OccurrenceResponse[];
  totals: OverdueTotal[];
}

// A nominal date can shift this many days forward into a range.
const MAX_SHIFT_DAYS = 2;

/** Most occurrences one Calendar / overdue read answers. */
export const MAX_OCCURRENCES = 1000;

/** How far back the overdue read generates occurrences, in days. */
export const OVERDUE_WINDOW_DAYS = 366;

type DerivedOccurrence = { source: BillSource; occurrence: Occurrence };

/** What one Calendar read combines. */
interface CalendarParts {
  derived: DerivedOccurrence[];
  bills: ProviderBill[];
  providers: Map<number, Account>;
  /** The derived payments' nominal `due_date` filter. */
  paymentDates: FindOperator<string>;
  today: string;
}

/**
 * The Calendar (lazy `BankModule`): derived occurrences of the owner's debt /
 * provider-expense schedules plus their one-off bills, computed in memory per
 * request (nothing is generated ahead of time, nothing is written). Payments
 * that no longer match a nominal occurrence (off-schedule) are not shown.
 */
@Injectable()
export class CalendarService {
  private readonly query: CalendarQuery;

  /**
   * @param {CalendarQuery} query - The Calendar reads.
   */
  constructor(query: CalendarQuery) {
    this.query = query;
  }

  /**
   * Every occurrence whose effective date is in the range, sorted by
   * effective date, then kind, source account id and bill id.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {CalendarQueryDto} range - The validated `from` / `to`.
   * @returns {Promise<CalendarResponse>} `{ occurrences, totals }`.
   * @throws {BadRequestException} 400 when `from > to` or the range exceeds 366 days.
   */
  async calendar(owner: OwnerContext, range: CalendarQueryDto): Promise<CalendarResponse> {
    const { from, to } = range;
    assertCalendarRange(from, to);

    const { scheduled, providers } = await this.query.sources(owner);
    const derived = scheduled.flatMap((source) =>
      occurrencesBetween(source.schedule, from, to).map((occurrence) => ({ source, occurrence })));
    const bills = await this.query.bills([...providers.keys()], Between(from, to));

    if (derived.length + bills.length > MAX_OCCURRENCES) {
      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_FAILED,
        message: `the range must not hold more than ${MAX_OCCURRENCES} occurrences`,
      });
    }

    const views = await this.#assemble({
      derived,
      bills,
      providers,
      paymentDates: Between(addDays(from, -MAX_SHIFT_DAYS), to),
      today: todayUtc(new Date()),
    });

    return { occurrences: views.map(({ response }) => response), totals: calendarTotals(views) };
  }

  /**
   * Every overdue occurrence (open, effective date before today), oldest first.
   * @param {OwnerContext} owner - The resolved owner.
   * @returns {Promise<OverdueResponse>} `{ occurrences, totals }`.
   */
  async overdue(owner: OwnerContext): Promise<OverdueResponse> {
    const today = todayUtc(new Date());
    const { scheduled, providers } = await this.query.sources(owner);
    const windowStart = addDays(today, -OVERDUE_WINDOW_DAYS);
    const derived = scheduled.flatMap((source) =>
      occurrencesBetween(source.schedule, windowStart, addDays(today, -1)).map((occurrence) => ({ source, occurrence })));
    const bills = await this.query.bills([...providers.keys()], Between(windowStart, addDays(today, -1)));
    const views = (await this.#assemble({ derived, bills, providers, paymentDates: LessThan(today), today }))
      .filter(({ response }) => response.status === 'overdue')
      .slice(0, MAX_OCCURRENCES);

    return { occurrences: views.map(({ response }) => response), totals: overdueTotals(views) };
  }

  async #assemble(parts: CalendarParts): Promise<OccurrenceView[]> {
    const sources = parts.derived.map(({ source }) => source);
    const sourceIds = [...new Set(sources.filter(({ bill }) => bill === null).map(({ account }) => account.id))];
    const recurringIds = [...new Set(sources.flatMap(({ bill }) => bill === null ? [] : [bill.id]))];
    const payments = await this.query.payments(sourceIds, recurringIds, parts.bills.map(({ id }) => id), parts.paymentDates);
    const refs = await this.query.refs([
      ...payments.map(({ payingAccountId }) => payingAccountId),
      ...parts.bills.map(({ payingAccountId }) => payingAccountId),
    ]);
    const derivedPayments = new Map<string, BillPayment>();
    const billPayments = new Map<number, BillPayment>();

    for (const payment of payments) {
      if (payment.billId === null) {
        derivedPayments.set(`${payment.providerBillId ?? `a${payment.sourceAccountId}`}:${payment.dueDate}`, payment);
      } else {
        billPayments.set(payment.billId, payment);
      }
    }

    const inputs = [
      ...parts.derived.map(({ source, occurrence }) =>
        derivedInput(source, occurrence, derivedPayments.get(`${source.bill?.id ?? `a${source.account.id}`}:${occurrence.nominal}`))),
      ...parts.bills.map((bill) =>
        billInput(bill, parts.providers.get(bill.providerAccountId) as Account, billPayments.get(bill.id), refs)),
    ];

    return inputs.map((input) => buildOccurrence(input, refs, parts.today)).sort(compareOccurrences);
  }
}
