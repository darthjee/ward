import { Injectable } from '@nestjs/common';
import type { ScheduleFieldsInput, ScheduleState } from './account-types/schedule-fields.js';
import { PayingAccountResolver } from './paying-account.resolver.js';
import type { OwnerContext } from '../core/owner-context.js';

/** What {@link AccountScheduleValidator.validate} checks. */
export interface ScheduleCheck {
  /** The type's nested body object, if any. */
  nested: unknown;
  /** The details prepared by the type handler. */
  prepared: unknown;
  /** The account's (final) currency. */
  currency: string;
  /** Whether the request changes the account's currency. */
  currencyChanged: boolean;
}

/**
 * The owner-aware check of the schedule fields on the generic account routes
 * (the type handlers are synchronous and owner-less): a default
 * `paying_account_id` must be a visible `regular`, non-archived account of the
 * same owner and currency. Types without schedule fields are never checked.
 */
@Injectable()
export class AccountScheduleValidator {
  private readonly payingAccounts: PayingAccountResolver;

  /**
   * @param {PayingAccountResolver} payingAccounts - Resolves body paying accounts.
   */
  constructor(payingAccounts: PayingAccountResolver) {
    this.payingAccounts = payingAccounts;
  }

  /**
   * Checks the merged default paying account when it is sent, or when the
   * currency changes under a stored one.
   * @param {OwnerContext} owner - The resolved owner.
   * @param {ScheduleCheck} check - The body, prepared details and currency.
   * @returns {Promise<void>}
   * @throws {UnprocessableEntityException} 422 "account not found" or "currency mismatch".
   */
  async validate(owner: OwnerContext, check: ScheduleCheck): Promise<void> {
    const payingAccountId = (check.prepared as Partial<ScheduleState> | undefined)?.payingAccountId;
    const sent = (check.nested as ScheduleFieldsInput | undefined)?.paying_account_id !== undefined;

    if (payingAccountId === undefined || payingAccountId === null || !(sent || check.currencyChanged)) {
      return;
    }

    await this.payingAccounts.resolve(owner, payingAccountId, check.currency);
  }
}
