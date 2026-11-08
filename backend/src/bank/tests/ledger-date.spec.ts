import { isAllowedLedgerDate, isIsoDate, todayUtc } from '../ledger-date.js';

describe('ledger dates', () => {
  const now = new Date('2026-11-08T23:30:00Z');

  it('formats today in UTC', () => {
    expect(todayUtc(now)).toBe('2026-11-08');
  });

  it.each(['2026-11-08', '2024-02-29', '1999-01-01'])('accepts the date %p', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '26-11-08', '2026-11-8', '2026-11-08T00:00:00Z', '0999-01-01', 20261108, null])(
    'rejects %p',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );

  it('accepts up to UTC today + 1 day', () => {
    expect(isAllowedLedgerDate('2026-11-09', now)).toBe(true);
    expect(isAllowedLedgerDate('2026-11-08', now)).toBe(true);
    expect(isAllowedLedgerDate('2020-01-01', now)).toBe(true);
    expect(isAllowedLedgerDate('2026-11-10', now)).toBe(false);
    expect(isAllowedLedgerDate('nope', now)).toBe(false);
  });
});
