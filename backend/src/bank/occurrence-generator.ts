// Pure occurrence generator of the recurring bills derived from debt and
// provider-expense accounts (see `docs/agents/specs/banking/bills.md`,
// *Recurrence model*). Dates are `YYYY-MM-DD` strings; the maths goes through
// `Date.UTC` only, with no date library. One-off bills never go through it
// (their nominal and effective dates are both their `dueDate`).

const DAY_MS = 24 * 60 * 60 * 1000;
const SATURDAY = 6;
const SUNDAY = 0;
// The weekend shift moves a date by at most this many days.
const MAX_SHIFT_DAYS = 2;

/** The schedule an account carries, as read by the generator. */
export interface BillSchedule {
  frequency: 'monthly' | 'yearly';
  dueDay: number | null;
  /** Used by `yearly` schedules only. */
  dueMonth: number | null;
  billsFrom: string | null;
  showInCalendar: boolean;
  archived: boolean;
}

/** One derived occurrence: its key (`nominal`) and its displayed / overdue date (`effective`). */
export interface Occurrence {
  nominal: string;
  effective: string;
}

/** An active schedule: every field the generator needs is set. */
type ActiveSchedule = BillSchedule & { dueDay: number; billsFrom: string };

/**
 * @param {number} year - The year.
 * @param {number} month - The month, 1–12.
 * @param {number} day - The day of the month.
 * @returns {string} The `YYYY-MM-DD` date.
 */
function formatDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/**
 * @param {string} date - A `YYYY-MM-DD` date.
 * @returns {Date} Its UTC midnight.
 */
function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/**
 * @param {number} year - The year.
 * @param {number} month - The month, 1–12.
 * @param {number} day - The requested day (1–31).
 * @returns {string} The date, the day clamped to the month's last day (31 → 30 Apr, 29–31 → 28 / 29 Feb).
 */
export function clampDay(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return formatDate(year, month, Math.min(day, lastDay));
}

/**
 * @param {string} date - A `YYYY-MM-DD` date.
 * @param {number} days - Days to add (may be negative).
 * @returns {string} The shifted date.
 */
export function addDays(date: string, days: number): string {
  return new Date(toUtc(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @param {string} date - A nominal due date.
 * @returns {string} The effective date: a Saturday or Sunday moves to the following Monday.
 */
export function shiftWeekend(date: string): string {
  const weekday = toUtc(date).getUTCDay();

  if (weekday === SATURDAY) {
    return addDays(date, 2);
  }

  return weekday === SUNDAY ? addDays(date, 1) : date;
}

/**
 * A schedule exists when `dueDay` is set, `showInCalendar` is `true` and the
 * account is not archived. A `null` `billsFrom` with a `dueDay` cannot happen
 * after the schedule-fields backfill; it is treated as "no schedule" rather
 * than inventing a start date (which could resurrect a phantom overdue backlog).
 * @param {BillSchedule} schedule - The account's schedule.
 * @returns {boolean} Whether the schedule produces occurrences.
 */
function isActive(schedule: BillSchedule): schedule is ActiveSchedule {
  const yearlyWithoutMonth = schedule.frequency === 'yearly' && schedule.dueMonth === null;

  return schedule.dueDay !== null && schedule.billsFrom !== null && schedule.showInCalendar && !schedule.archived &&
    !yearlyWithoutMonth;
}

/**
 * @param {ActiveSchedule} schedule - An active schedule.
 * @param {number} year - The period's year.
 * @param {number} month - The period's month (ignored by yearly schedules).
 * @returns {string} The period's nominal due date (clamped).
 */
function nominalOf(schedule: ActiveSchedule, year: number, month: number): string {
  return schedule.frequency === 'yearly'
    ? clampDay(year, schedule.dueMonth as number, schedule.dueDay)
    : clampDay(year, month, schedule.dueDay);
}

/**
 * @param {ActiveSchedule} schedule - An active schedule.
 * @param {string} start - The first nominal date accepted.
 * @param {string} end - The last nominal date accepted.
 * @returns {string[]} The nominal dates in `[start, end]`, ascending: exactly one per period.
 */
function nominalsBetween(schedule: ActiveSchedule, start: string, end: string): string[] {
  const nominals: string[] = [];
  const step = schedule.frequency === 'yearly' ? 12 : 1;
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));

  for (;;) {
    const nominal = nominalOf(schedule, year, month);

    if (nominal > end) {
      return nominals;
    }

    if (nominal >= start) {
      nominals.push(nominal);
    }

    month += step;
    year += Math.floor((month - 1) / 12);
    month = ((month - 1) % 12) + 1;
  }
}

/**
 * The occurrences whose **effective** date is in `[from, to]`, ascending. A
 * nominal date up to two days before `from` can shift into the range, so the
 * scan starts there (but never before `billsFrom`).
 * @param {BillSchedule} schedule - The account's schedule.
 * @param {string} from - First effective date (inclusive).
 * @param {string} to - Last effective date (inclusive).
 * @returns {Occurrence[]} The occurrences; none without an active schedule.
 */
export function occurrencesBetween(schedule: BillSchedule, from: string, to: string): Occurrence[] {
  if (!isActive(schedule) || from > to) {
    return [];
  }

  const scanFrom = addDays(from, -MAX_SHIFT_DAYS);
  const start = scanFrom > schedule.billsFrom ? scanFrom : schedule.billsFrom;

  return nominalsBetween(schedule, start, to)
    .map((nominal) => ({ nominal, effective: shiftWeekend(nominal) }))
    .filter(({ effective }) => effective >= from && effective <= to);
}

/**
 * Every occurrence whose effective date is before `today`, from `billsFrom`
 * on (whether it is open is decided against the payments by the caller).
 * @param {BillSchedule} schedule - The account's schedule.
 * @param {string} today - Today (UTC), `YYYY-MM-DD`.
 * @returns {Occurrence[]} The past occurrences, ascending.
 */
export function pastOccurrences(schedule: BillSchedule, today: string): Occurrence[] {
  if (!isActive(schedule)) {
    return [];
  }

  return occurrencesBetween(schedule, schedule.billsFrom, addDays(today, -1));
}

/**
 * @param {BillSchedule} schedule - The account's schedule.
 * @param {string} date - A candidate nominal due date (`YYYY-MM-DD`).
 * @returns {boolean} Whether `date` is a nominal occurrence of the active
 *   schedule, on or after `billsFrom`.
 */
export function isNominalOccurrence(schedule: BillSchedule, date: string): boolean {
  if (!isActive(schedule) || date < schedule.billsFrom) {
    return false;
  }

  return nominalOf(schedule, Number(date.slice(0, 4)), Number(date.slice(5, 7))) === date;
}
