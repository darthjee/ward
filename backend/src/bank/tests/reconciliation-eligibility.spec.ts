import { ineligibilityReason, isEligibleToTick, shouldAutoUntick } from '../reconciliation-eligibility.js';

const statement = { id: 7, statementDate: '2026-10-31' };
const account = { openingDate: '2026-01-01' };

describe('ineligibilityReason', () => {
  it('flags a row after the statement date', () => {
    expect(ineligibilityReason({ date: '2026-11-01', reconciliationId: null }, statement, account)).toBe('after_statement');
  });

  it('flags a row before the opening date', () => {
    expect(ineligibilityReason({ date: '2025-12-31', reconciliationId: null }, statement, account)).toBe('before_opening');
  });

  it('flags a row cleared by a different statement', () => {
    expect(ineligibilityReason({ date: '2026-05-01', reconciliationId: 3 }, statement, account)).toBe('cleared_elsewhere');
  });

  it('accepts a free row inside the window', () => {
    expect(ineligibilityReason({ date: '2026-05-01', reconciliationId: null }, statement, account)).toBeNull();
  });

  it('accepts rows exactly on the statement date and exactly on the opening date', () => {
    expect(ineligibilityReason({ date: '2026-10-31', reconciliationId: null }, statement, account)).toBeNull();
    expect(ineligibilityReason({ date: '2026-01-01', reconciliationId: null }, statement, account)).toBeNull();
  });

  it('accepts a row already ticked on this statement', () => {
    expect(ineligibilityReason({ date: '2026-05-01', reconciliationId: 7 }, statement, account)).toBeNull();
  });
});

describe('isEligibleToTick', () => {
  it('wraps ineligibilityReason', () => {
    expect(isEligibleToTick({ date: '2026-05-01', reconciliationId: null }, statement, account)).toBe(true);
    expect(isEligibleToTick({ date: '2026-11-01', reconciliationId: null }, statement, account)).toBe(false);
  });
});

describe('shouldAutoUntick', () => {
  it('unticks a row moved past the statement date', () => {
    expect(shouldAutoUntick('2026-11-01', statement, account)).toBe(true);
  });

  it('unticks a row moved before the opening date', () => {
    expect(shouldAutoUntick('2025-12-31', statement, account)).toBe(true);
  });

  it('keeps the tick exactly on the statement date and exactly on the opening date', () => {
    expect(shouldAutoUntick('2026-10-31', statement, account)).toBe(false);
    expect(shouldAutoUntick('2026-01-01', statement, account)).toBe(false);
  });

  it('keeps the tick for a date inside the window', () => {
    expect(shouldAutoUntick('2026-06-15', statement, account)).toBe(false);
  });
});
