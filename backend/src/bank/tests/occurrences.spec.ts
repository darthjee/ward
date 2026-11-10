import {
  addDays,
  clampDay,
  isNominalOccurrence,
  occurrencesBetween,
  pastOccurrences,
  shiftWeekend,
  type BillSchedule,
} from '../occurrence-generator.js';

const monthly = (overrides: Partial<BillSchedule> = {}): BillSchedule => ({
  frequency: 'monthly',
  dueDay: 10,
  dueMonth: null,
  billsFrom: '2026-01-01',
  showInCalendar: true,
  archived: false,
  ...overrides,
});

const yearly = (overrides: Partial<BillSchedule> = {}): BillSchedule =>
  monthly({ frequency: 'yearly', dueMonth: 3, ...overrides });

const nominals = (schedule: BillSchedule, from: string, to: string): string[] =>
  occurrencesBetween(schedule, from, to).map(({ nominal }) => nominal);

describe('occurrence generator', () => {
  describe('helpers', () => {
    it('clamps the day to the month\'s last day', () => {
      expect(clampDay(2026, 4, 31)).toBe('2026-04-30');
      expect(clampDay(2026, 2, 29)).toBe('2026-02-28');
      expect(clampDay(2026, 2, 31)).toBe('2026-02-28');
      expect(clampDay(2028, 2, 30)).toBe('2028-02-29');
      expect(clampDay(2026, 1, 31)).toBe('2026-01-31');
      expect(clampDay(2026, 12, 15)).toBe('2026-12-15');
    });

    it('adds days across months and years', () => {
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('shifts Saturday and Sunday to the next Monday and leaves weekdays alone', () => {
      expect(shiftWeekend('2026-01-10')).toBe('2026-01-12'); // Saturday
      expect(shiftWeekend('2026-01-11')).toBe('2026-01-12'); // Sunday
      expect(shiftWeekend('2026-01-12')).toBe('2026-01-12'); // Monday
      expect(shiftWeekend('2026-01-16')).toBe('2026-01-16'); // Friday
      expect(shiftWeekend('2026-01-31')).toBe('2026-02-02'); // Saturday across a month end
    });
  });

  describe('monthly schedules', () => {
    it('produces one occurrence per month, ignoring due_month', () => {
      expect(nominals(monthly({ dueMonth: 7 }), '2026-01-01', '2026-04-30')).toEqual([
        '2026-01-10',
        '2026-02-10',
        '2026-03-10',
        '2026-04-10',
      ]);
    });

    it('clamps day 31 to the last day of every shorter month, once per period', () => {
      // 2026-05-31 is a Sunday: its effective date (1 Jun) is still in the range.
      expect(nominals(monthly({ dueDay: 31 }), '2026-01-01', '2026-06-05')).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
        '2026-04-30',
        '2026-05-31',
      ]);
    });

    it.each([
      [29, '2026-02-28'],
      [30, '2026-02-28'],
      [31, '2026-02-28'],
    ])('clamps day %i to 28 Feb in a non-leap year', (dueDay, expected) => {
      // 2026-02-28 is a Saturday, effective 2 Mar.
      expect(nominals(monthly({ dueDay, billsFrom: '2026-02-01' }), '2026-02-01', '2026-03-03')).toEqual([expected]);
    });

    it.each([29, 30, 31])('clamps day %i to 29 Feb in a leap year', (dueDay) => {
      expect(nominals(monthly({ dueDay, billsFrom: '2028-01-01' }), '2028-02-01', '2028-03-02')).toEqual(['2028-02-29']);
    });

    it('crosses year boundaries', () => {
      expect(nominals(monthly({ dueDay: 15 }), '2026-11-01', '2027-02-28')).toEqual([
        '2026-11-15',
        '2026-12-15',
        '2027-01-15',
        '2027-02-15',
      ]);
    });
  });

  describe('yearly schedules', () => {
    it('produces one occurrence per year on due_day / due_month', () => {
      expect(nominals(yearly({ dueDay: 20 }), '2026-01-01', '2028-12-31')).toEqual(['2026-03-20', '2027-03-20', '2028-03-20']);
    });

    it('clamps 29 Feb to 28 Feb in non-leap years', () => {
      expect(nominals(yearly({ dueDay: 29, dueMonth: 2 }), '2026-01-01', '2028-12-31')).toEqual([
        '2026-02-28',
        '2027-02-28',
        '2028-02-29',
      ]);
    });

    it('produces nothing without a due_month', () => {
      expect(nominals(yearly({ dueMonth: null }), '2026-01-01', '2026-12-31')).toEqual([]);
    });
  });

  describe('bills_from start', () => {
    it('starts at the first due date on or after bills_from', () => {
      expect(nominals(monthly({ billsFrom: '2026-01-11' }), '2025-01-01', '2026-03-31')).toEqual(['2026-02-10', '2026-03-10']);
      expect(nominals(monthly({ billsFrom: '2026-01-10' }), '2025-01-01', '2026-01-31')).toEqual(['2026-01-10']);
      expect(nominals(yearly({ billsFrom: '2026-03-21' }), '2026-01-01', '2027-12-31')).toEqual(['2027-03-10']);
    });

    it('uses only bills_from, never an opening date (no phantom backlog)', () => {
      const schedule = monthly({ billsFrom: '2026-06-01' });

      expect(pastOccurrences(schedule, '2026-08-01').map(({ nominal }) => nominal)).toEqual(['2026-06-10', '2026-07-10']);
    });

    it('treats a null bills_from as no schedule', () => {
      expect(nominals(monthly({ billsFrom: null }), '2026-01-01', '2026-12-31')).toEqual([]);
    });
  });

  describe('weekend shift', () => {
    it('keeps the nominal date and shifts the effective date to Monday', () => {
      // 2026-01-10 is a Saturday, 2026-05-10 a Sunday.
      expect(occurrencesBetween(monthly(), '2026-01-01', '2026-01-31')).toEqual([
        { nominal: '2026-01-10', effective: '2026-01-12' },
      ]);
      expect(occurrencesBetween(monthly(), '2026-05-01', '2026-05-31')).toEqual([
        { nominal: '2026-05-10', effective: '2026-05-11' },
      ]);
    });

    it('filters on the effective date (a nominal date shifted into the range is included)', () => {
      // 2026-01-31 is a Saturday: effective 2026-02-02.
      const schedule = monthly({ dueDay: 31 });

      expect(occurrencesBetween(schedule, '2026-02-01', '2026-02-05')).toEqual([{ nominal: '2026-01-31', effective: '2026-02-02' }]);
      expect(occurrencesBetween(schedule, '2026-01-25', '2026-01-31')).toEqual([]);
    });
  });

  describe('schedules that produce nothing', () => {
    it.each([
      ['show_in_calendar false', monthly({ showInCalendar: false })],
      ['no due_day', monthly({ dueDay: null })],
      ['an archived account', monthly({ archived: true })],
    ])('%s produces nothing, past or future', (_label, schedule) => {
      expect(occurrencesBetween(schedule, '2020-01-01', '2030-12-31')).toEqual([]);
      expect(pastOccurrences(schedule, '2030-01-01')).toEqual([]);
      expect(isNominalOccurrence(schedule, '2026-02-10')).toBe(false);
    });

    it('answers nothing for an inverted range', () => {
      expect(occurrencesBetween(monthly(), '2026-03-01', '2026-02-01')).toEqual([]);
    });
  });

  describe('open-ended', () => {
    it('keeps producing occurrences years ahead (no instalment count or balance input)', () => {
      expect(nominals(monthly(), '2040-01-01', '2040-12-31')).toHaveLength(12);
    });
  });

  describe('pastOccurrences', () => {
    it('lists the occurrences whose effective date is before today', () => {
      // 2026-01-10 (Saturday) is effective 2026-01-12, so it is not past on 2026-01-12.
      expect(pastOccurrences(monthly(), '2026-01-12')).toEqual([]);
      expect(pastOccurrences(monthly(), '2026-01-13')).toEqual([{ nominal: '2026-01-10', effective: '2026-01-12' }]);
    });

    it('is empty when bills_from is in the future', () => {
      expect(pastOccurrences(monthly({ billsFrom: '2027-01-01' }), '2026-06-01')).toEqual([]);
    });
  });

  describe('isNominalOccurrence', () => {
    it('accepts on-schedule nominal dates', () => {
      expect(isNominalOccurrence(monthly(), '2026-02-10')).toBe(true);
      expect(isNominalOccurrence(monthly({ dueDay: 31 }), '2026-02-28')).toBe(true);
      expect(isNominalOccurrence(yearly(), '2027-03-10')).toBe(true);
    });

    it('rejects off-schedule dates, effective dates and dates before bills_from', () => {
      expect(isNominalOccurrence(monthly(), '2026-02-11')).toBe(false);
      expect(isNominalOccurrence(monthly(), '2026-01-12')).toBe(false);
      expect(isNominalOccurrence(yearly(), '2027-04-10')).toBe(false);
      expect(isNominalOccurrence(monthly({ billsFrom: '2026-03-01' }), '2026-02-10')).toBe(false);
    });
  });
});
