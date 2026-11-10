import { Injectable } from '@nestjs/common';
import { Between, LessThan, type FindOperator } from 'typeorm';
import type { BillSource } from './bill-schedule.js';
import { calendarTotals, overdueTotals, type CalendarTotal, type OverdueTotal } from './calendar-totals.js';
import { CalendarQuery } from './calendar.query.js';
import type { OwnerContext } from '../core/owner-context.js';
import { assertCalendarRange, type CalendarQueryDto } from './dto/calendar-query.dto.js';
import type { Account } from './entities/account.entity.js';
import type { BillPayment } from './entities/bill-payment.entity.js';
import type { Bill } from './entities/bill.entity.js';
import { todayUtc } from './ledger-date.js';
import { addDays, occurrencesBetween, pastOccurrences, type Occurrence } from './occurrence-generator.js';
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

type DerivedOccurrence = { source: BillSource; occurrence: Occurrence };

/** What one Calendar read combines. */
interface CalendarParts {
  derived: DerivedOccurrence[];
  bills: Bill[];
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
    const derived = scheduled.flatMap((source) =>
      pastOccurrences(source.schedule, today).map((occurrence) => ({ source, occurrence })));
    const bills = await this.query.bills([...providers.keys()], LessThan(today));
    const views = (await this.#assemble({ derived, bills, providers, paymentDates: LessThan(today), today }))
      .filter(({ response }) => response.status === 'overdue');

    return { occurrences: views.map(({ response }) => response), totals: overdueTotals(views) };
  }

  async #assemble(parts: CalendarParts): Promise<OccurrenceView[]> {
    const sourceIds = [...new Set(parts.derived.map(({ source }) => source.account.id))];
    const payments = await this.query.payments(sourceIds, parts.bills.map(({ id }) => id), parts.paymentDates);
    const refs = await this.query.refs([
      ...payments.map(({ payingAccountId }) => payingAccountId),
      ...parts.bills.map(({ payingAccountId }) => payingAccountId),
    ]);
    const derivedPayments = new Map<string, BillPayment>();
    const billPayments = new Map<number, BillPayment>();

    for (const payment of payments) {
      if (payment.billId === null) {
        derivedPayments.set(`${payment.sourceAccountId}:${payment.dueDate}`, payment);
      } else {
        billPayments.set(payment.billId, payment);
      }
    }

    const inputs = [
      ...parts.derived.map(({ source, occurrence }) =>
        derivedInput(source, occurrence, derivedPayments.get(`${source.account.id}:${occurrence.nominal}`))),
      ...parts.bills.map((bill) =>
        billInput(bill, parts.providers.get(bill.providerAccountId) as Account, billPayments.get(bill.id), refs)),
    ];

    return inputs.map((input) => buildOccurrence(input, refs, parts.today)).sort(compareOccurrences);
  }
}
