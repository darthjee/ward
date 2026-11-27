import {
  eligibleIds, isCleared, isEligible, isTicked, visibleRows,
} from '../../../../../../../../../assets/js/components/resources/bank/common/reconciliation/controllers/eligibility.js';

const ACCOUNT = { opening_date: '2026-01-01' };
const STATEMENT = { id: 4, statement_date: '2026-03-31' };
const CTX = { account: ACCOUNT, statement: STATEMENT };

function row(id, date, reconciliation = null) {
  return { id, date, reconciliation };
}

describe('eligibility', () => {
  describe('isEligible', () => {
    it('accepts a row inside the window', () => {
      expect(isEligible(row(1, '2026-02-10'), CTX)).toBeTrue();
    });

    it('accepts a row on the opening date', () => {
      expect(isEligible(row(1, '2026-01-01'), CTX)).toBeTrue();
    });

    it('accepts a row on the statement date', () => {
      expect(isEligible(row(1, '2026-03-31'), CTX)).toBeTrue();
    });

    it('rejects a row before the opening date', () => {
      expect(isEligible(row(1, '2025-12-31'), CTX)).toBeFalse();
    });

    it('rejects a row after the statement date', () => {
      expect(isEligible(row(1, '2026-04-01'), CTX)).toBeFalse();
    });

    it('rejects a row cleared by an earlier statement', () => {
      expect(isEligible(row(1, '2026-02-10', { id: 2 }), CTX)).toBeFalse();
    });

    it('accepts a row ticked on the open statement', () => {
      expect(isEligible(row(1, '2026-02-10', { id: 4 }), CTX)).toBeTrue();
    });

    it('rejects the opening row', () => {
      expect(isEligible({ date: '2026-01-01', amount: '0', balance: '0' }, CTX)).toBeFalse();
      expect(isEligible({ id: 9, opening: true, date: '2026-02-01' }, CTX)).toBeFalse();
    });

    it('rejects a missing row', () => {
      expect(isEligible(null, CTX)).toBeFalse();
    });
  });

  describe('isTicked', () => {
    it('reads the server value', () => {
      expect(isTicked(row(1, '2026-02-10', { id: 4 }), { statement: STATEMENT, ticked: new Map() })).toBeTrue();
      expect(isTicked(row(1, '2026-02-10'), { statement: STATEMENT, ticked: new Map() })).toBeFalse();
      expect(isTicked(row(1, '2026-02-10', { id: 2 }), { statement: STATEMENT, ticked: new Map() })).toBeFalse();
    });

    it('lets the overlay win', () => {
      expect(isTicked(row(1, '2026-02-10', { id: 4 }), { statement: STATEMENT, ticked: new Map([[1, false]]) })).toBeFalse();
      expect(isTicked(row(1, '2026-02-10'), { statement: STATEMENT, ticked: new Map([[1, true]]) })).toBeTrue();
    });
  });

  describe('eligibleIds', () => {
    it('lists the eligible ids only', () => {
      const rows = [row(1, '2026-02-10'), row(2, '2026-05-01'), row(3, '2026-02-11', { id: 2 }), row(4, '2026-03-01', { id: 4 })];

      expect(eligibleIds(rows, CTX)).toEqual([1, 4]);
    });
  });

  describe('isCleared', () => {
    it('is true for a row on a finished statement', () => {
      expect(isCleared(row(1, '2026-02-10', { id: 2, status: 'finished' }))).toBeTrue();
    });

    it('is false for a row on an open statement', () => {
      expect(isCleared(row(1, '2026-02-10', { id: 4, status: 'open' }))).toBeFalse();
    });

    it('is false for an uncleared row', () => {
      expect(isCleared(row(1, '2026-02-10'))).toBeFalse();
    });
  });

  describe('visibleRows', () => {
    const rows = [row(1, '2026-02-10'), row(2, '2026-02-11', { id: 2 }), row(3, '2026-02-12', { id: 4 }), row(4, '2026-02-13')];
    const state = { statement: STATEMENT, ticked: new Map() };

    it('shows every row when the filter is off', () => {
      expect(visibleRows(rows, state, false)).toBe(rows);
    });

    it('drops the cleared and the ticked rows when the filter is on', () => {
      expect(visibleRows(rows, state, true).map((r) => r.id)).toEqual([1, 4]);
    });

    it('honours the overlay', () => {
      const overlay = { statement: STATEMENT, ticked: new Map([[1, true], [3, false]]) };

      expect(visibleRows(rows, overlay, true).map((r) => r.id)).toEqual([3, 4]);
    });
  });
});
