import {
  isAfterLocalToday, lastFullMonth, localToday, monthName,
} from '../../../../../../../assets/js/components/resources/bank/common/dates.js';

describe('dates', () => {
  const now = new Date(2026, 0, 5, 23, 30);

  describe('localToday', () => {
    it('builds the local date', () => {
      expect(localToday(now)).toBe('2026-01-05');
    });

    it('defaults to the current date', () => {
      expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('isAfterLocalToday', () => {
    it('is false for today', () => {
      expect(isAfterLocalToday('2026-01-05', now)).toBeFalse();
    });

    it('is false for a past date', () => {
      expect(isAfterLocalToday('2025-12-31', now)).toBeFalse();
    });

    it('is true for tomorrow', () => {
      expect(isAfterLocalToday('2026-01-06', now)).toBeTrue();
    });

    it('defaults to the current date', () => {
      expect(isAfterLocalToday('9999-12-31')).toBeTrue();
    });
  });

  describe('monthName', () => {
    it('names a month in the browser locale', () => {
      expect(monthName(1)).toBe(new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, 0, 1)));
      expect(monthName(12)).toBe(new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, 11, 1)));
    });

    it('is empty when unset', () => {
      expect(monthName(null)).toBe('');
      expect(monthName(0)).toBe('');
    });
  });

  describe('lastFullMonth', () => {
    it('spans the previous calendar month', () => {
      expect(lastFullMonth(new Date(2026, 2, 15))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    });

    it('goes back to the previous year in January', () => {
      expect(lastFullMonth(now)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    });

    it('handles leap years and month ends', () => {
      expect(lastFullMonth(new Date(2028, 2, 31))).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    });

    it('defaults to the current date', () => {
      expect(lastFullMonth().from).toMatch(/^\d{4}-\d{2}-01$/);
    });
  });
});
