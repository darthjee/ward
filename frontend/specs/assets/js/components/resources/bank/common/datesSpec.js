import {
  formatDate, isAfterLocalToday, lastFullMonth, localToday, monthName,
} from '../../../../../../../assets/js/components/resources/bank/common/dates.js';
import DisplayLocale from '../../../../../../../assets/js/utils/locale/DisplayLocale.js';

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

    it('names a month in the display locale', () => {
      DisplayLocale.set('pt-BR');
      const pt = monthName(3);
      DisplayLocale.set('en-US');
      const en = monthName(3);
      DisplayLocale.set(null);

      expect([pt, en]).toEqual(['março', 'March']);
    });

    it('is empty when unset', () => {
      expect(monthName(null)).toBe('');
      expect(monthName(0)).toBe('');
    });
  });

  describe('formatDate', () => {
    afterEach(() => {
      DisplayLocale.set(null);
    });

    it('formats day-first in pt-BR', () => {
      DisplayLocale.set('pt-BR');

      expect(formatDate('2026-03-14')).toBe('14/03/2026');
    });

    it('formats month-first in en-US', () => {
      DisplayLocale.set('en-US');

      expect(formatDate('2026-03-14')).toBe('3/14/2026');
    });

    it('matches the browser default when no locale is set', () => {
      const expected = new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
      }).format(new Date(Date.UTC(2026, 2, 14)));

      expect(formatDate('2026-03-14')).toBe(expected);
    });

    it('keeps the day on month and year boundaries', () => {
      DisplayLocale.set('pt-BR');

      expect(['2026-01-01', '2025-12-31', '2026-03-31'].map(formatDate))
        .toEqual(['01/01/2026', '31/12/2025', '31/03/2026']);
    });

    it('does not depend on the process time zone', () => {
      const original = process.env.TZ;
      DisplayLocale.set('pt-BR');

      try {
        const results = ['America/Sao_Paulo', 'Pacific/Kiritimati'].map((zone) => {
          process.env.TZ = zone;

          return formatDate('2026-01-01');
        });

        expect(results).toEqual(['01/01/2026', '01/01/2026']);
      } finally {
        if (original === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = original;
        }
      }
    });

    it('returns empty for null, undefined and empty', () => {
      expect([formatDate(null), formatDate(undefined), formatDate('')]).toEqual(['', '', '']);
    });

    it('returns unrecognised input unchanged', () => {
      expect(formatDate('garbage')).toBe('garbage');
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
