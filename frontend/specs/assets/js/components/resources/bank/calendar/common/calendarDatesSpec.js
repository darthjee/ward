import {
  addDays, weekStart, monthRange, shiftMonth, maxMonth, parseMonth, monthGridWeeks,
  formatWeekdayDay, formatWeekday, upcomingRange,
} from '../../../../../../../../assets/js/components/resources/bank/calendar/common/calendarDates.js';

describe('calendarDates', () => {
  describe('addDays', () => {
    it('crosses month and year boundaries', () => {
      expect(addDays('2026-12-31', 1)).toEqual('2027-01-01');
      expect(addDays('2026-03-01', -1)).toEqual('2026-02-28');
    });

    it('handles leap years', () => {
      expect(addDays('2028-02-28', 1)).toEqual('2028-02-29');
    });
  });

  describe('weekStart', () => {
    it('returns the same day for a Monday', () => {
      expect(weekStart('2026-11-09')).toEqual('2026-11-09');
    });

    it('returns the previous Monday for a Sunday', () => {
      expect(weekStart('2026-11-15')).toEqual('2026-11-09');
    });
  });

  describe('monthRange', () => {
    it('returns the month bounds', () => {
      expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
      expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
      expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    });
  });

  describe('shiftMonth / maxMonth', () => {
    it('shifts across years', () => {
      expect(shiftMonth('2026-12', 1)).toEqual('2027-01');
      expect(shiftMonth('2026-01', -1)).toEqual('2025-12');
    });

    it('returns the local month + 12', () => {
      expect(maxMonth('2026-11-14')).toEqual('2027-11');
    });
  });

  describe('parseMonth', () => {
    const today = '2026-11-14';

    it('keeps a valid month', () => {
      expect(parseMonth('2026-05', today)).toEqual('2026-05');
    });

    it('has no lower bound', () => {
      expect(parseMonth('2001-01', today)).toEqual('2001-01');
    });

    it('clamps at +12 months', () => {
      expect(parseMonth('2030-01', today)).toEqual('2027-11');
    });

    it('falls back to the current month for invalid values', () => {
      expect(parseMonth('2026-13', today)).toEqual('2026-11');
      expect(parseMonth('abc', today)).toEqual('2026-11');
      expect(parseMonth('', today)).toEqual('2026-11');
      expect(parseMonth(null, today)).toEqual('2026-11');
      expect(parseMonth(undefined, today)).toEqual('2026-11');
    });
  });

  describe('monthGridWeeks', () => {
    it('builds Monday-first weeks of 7 days with adjacent days flagged', () => {
      const weeks = monthGridWeeks('2026-11');

      expect(weeks.length).toEqual(6);
      weeks.forEach((week) => expect(week.length).toEqual(7));
      expect(weeks[0][0]).toEqual({ date: '2026-10-26', inMonth: false });
      expect(weeks[0][6]).toEqual({ date: '2026-11-01', inMonth: true });
      expect(weeks[5][0]).toEqual({ date: '2026-11-30', inMonth: true });
      expect(weeks[5][1]).toEqual({ date: '2026-12-01', inMonth: false });
    });

    it('does not add an empty trailing week', () => {
      const weeks = monthGridWeeks('2027-02');

      expect(weeks.length).toEqual(4);
      expect(weeks[3][6]).toEqual({ date: '2027-02-28', inMonth: true });
    });
  });

  describe('formatWeekdayDay', () => {
    it('contains the day number', () => {
      expect(formatWeekdayDay('2026-11-14')).toContain('14');
    });
  });

  describe('formatWeekday', () => {
    it('does not contain the day number', () => {
      expect(formatWeekday('2026-11-14')).not.toContain('14');
    });
  });

  describe('upcomingRange', () => {
    it('spans today to today + 59 days', () => {
      expect(upcomingRange('2026-11-14')).toEqual({ from: '2026-11-14', to: '2027-01-12' });
    });
  });
});
