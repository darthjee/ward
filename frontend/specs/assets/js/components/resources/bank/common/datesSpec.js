import { isAfterLocalToday, localToday } from '../../../../../../../assets/js/components/resources/bank/common/dates.js';

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
});
