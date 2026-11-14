import type { AccountRef } from '../account-refs.js';

// Pure helpers of the bill schedule fields shared by the debt and
// provider-expense details (see `docs/agents/modules/bank/bills.md`,
// "Schedule fields on source accounts").

/** The schedule fields stored on a details row. */
export type ScheduleState = {
  billsFrom: string | null;
  showInCalendar: boolean;
  payingAccountId: number | null;
};

/** The body fields of the schedule (snake_case), as validated by the details DTOs. */
export interface ScheduleFieldsInput {
  bills_from?: string | null;
  show_in_calendar?: boolean;
  paying_account_id?: number | null;
}

/** What the `bills_from` lifecycle reads from a state. */
export type ScheduleStart = { dueDay: number | null; billsFrom: string | null };

/** The plain-copy schedule fields: body key -> state property. */
export const SCHEDULE_COPIED_FIELDS = [
  ['bills_from', 'billsFrom'],
  ['show_in_calendar', 'showInCalendar'],
  ['paying_account_id', 'payingAccountId'],
] as const;

/** The schedule fields of the nested response object: the paying account by id and name only. */
export type ScheduleResponse = {
  bills_from: string | null;
  show_in_calendar: boolean;
  paying_account: AccountRef | null;
};

/** A loaded details row, with its default paying account's ref (see `withPayingAccounts`). */
export type WithPayingAccount = { payingAccount?: AccountRef | null };

/**
 * @returns {ScheduleState} The schedule of a new account: shown in the
 *   Calendar, no start and no default paying account.
 */
export function defaultScheduleState(): ScheduleState {
  return { billsFrom: null, showInCalendar: true, payingAccountId: null };
}

/**
 * @param {ScheduleState} details - A loaded row (or any object carrying the schedule fields).
 * @returns {ScheduleState} Only the schedule fields.
 */
export function scheduleStateOf(details: ScheduleState): ScheduleState {
  const { billsFrom, showInCalendar, payingAccountId } = details;

  return { billsFrom, showInCalendar, payingAccountId };
}

/**
 * The `bills_from` lifecycle: setting `due_day` for the first time while
 * `bills_from` is `null` and not sent sets it to `today`; clearing `due_day`
 * keeps it. Mutates `merged`.
 * @param {ScheduleStart} base - The stored (or default) `dueDay` / `billsFrom`.
 * @param {ScheduleStart} merged - The merged state, updated in place.
 * @param {ScheduleFieldsInput} input - The validated nested body.
 * @param {string} today - Today (UTC), `YYYY-MM-DD`.
 * @returns {void}
 */
export function applyBillsFromLifecycle(
  base: ScheduleStart,
  merged: ScheduleStart,
  input: ScheduleFieldsInput,
  today: string,
): void {
  const firstDueDay = base.dueDay === null && merged.dueDay !== null;

  if (firstDueDay && base.billsFrom === null && input.bills_from === undefined) {
    merged.billsFrom = today;
  }
}

/**
 * @param {ScheduleState} state - The schedule fields.
 * @param {AccountRef | null} payingAccount - The default paying account's ref, if loaded.
 * @returns {ScheduleResponse} The schedule fields of the nested response object.
 */
export function serializeScheduleFields(state: ScheduleState, payingAccount: AccountRef | null): ScheduleResponse {
  return {
    bills_from: state.billsFrom,
    show_in_calendar: state.showInCalendar,
    paying_account: state.payingAccountId === null ? null : payingAccount,
  };
}
