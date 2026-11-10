import { Get, Query, ValidationPipe } from '@nestjs/common';
import { BankModuleLoader } from './bank-module.loader.js';
import type { CalendarResponse, OverdueResponse } from './calendar.service.js';
import { CurrentOwner } from '../core/current-owner.decorator.js';
import type { OwnerContext } from '../core/owner-context.js';
import { OwnerScopedController } from '../core/owner-scoped.decorator.js';
import { CalendarQueryDto } from './dto/calendar-query.dto.js';

const QUERY_PIPE = new ValidationPipe({ whitelist: true, transform: true });

/**
 * Calendar routes, mounted under `bank/…` and `orgs/:orgId/bank/…`. Thin:
 * validates the query, loads the lazy `BankModule` and delegates to its
 * `CalendarService`. Both routes are `user-scoped` (class level, from
 * `@OwnerScopedController`).
 */
@OwnerScopedController('bank')
export class CalendarController {
  private readonly loader: BankModuleLoader;

  /**
   * @param {BankModuleLoader} loader - Loads the lazy `BankModule`.
   */
  constructor(loader: BankModuleLoader) {
    this.loader = loader;
  }

  /**
   * `GET <base>/calendar.json?from=&to=`.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {CalendarQueryDto} query - `from` and `to`.
   * @returns {Promise<CalendarResponse>} `{ occurrences, totals }`.
   */
  @Get('calendar.json')
  async calendar(@CurrentOwner() owner: OwnerContext, @Query(QUERY_PIPE) query: CalendarQueryDto): Promise<CalendarResponse> {
    const { calendar } = await this.loader.services();

    return calendar.calendar(owner, query);
  }

  /**
   * `GET <base>/calendar/overdue.json`.
   * @param {OwnerContext} owner - The resolved owner.
   * @returns {Promise<OverdueResponse>} `{ occurrences, totals }`, oldest first.
   */
  @Get('calendar/overdue.json')
  async overdue(@CurrentOwner() owner: OwnerContext): Promise<OverdueResponse> {
    const { calendar } = await this.loader.services();

    return calendar.overdue(owner);
  }
}
