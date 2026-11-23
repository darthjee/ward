import {
  clearedBalance,
  isBalanced,
  reconciliationDifference,
  reconciliationStatus,
  sumToBigInt,
} from '../reconciliation-balance.js';

describe('sumToBigInt', () => {
  it('converts a SQL SUM string to bigint', () => {
    expect(sumToBigInt('12345')).toBe(12345n);
    expect(sumToBigInt('-500')).toBe(-500n);
  });

  it('turns a NULL or absent SUM into 0n', () => {
    expect(sumToBigInt(null)).toBe(0n);
    expect(sumToBigInt(undefined)).toBe(0n);
  });

  it('keeps full precision near the 10^13 bound', () => {
    expect(sumToBigInt('9999999999999')).toBe(9_999_999_999_999n);
  });
});

describe('clearedBalance', () => {
  it('is the opening anchor alone when nothing is cleared', () => {
    expect(clearedBalance(10_000n, 0n)).toBe(10_000n);
  });

  it('adds the cleared sum to the anchor', () => {
    expect(clearedBalance(10_000n, -2_500n)).toBe(7_500n);
  });

  it('keeps full precision for values near the 10^13 bound', () => {
    expect(clearedBalance(9_999_999_999_999n, 1n)).toBe(10_000_000_000_000n);
  });
});

describe('reconciliationDifference', () => {
  it('is statement balance minus (cleared + ticked)', () => {
    expect(reconciliationDifference(10_000n, 6_000n, 3_000n)).toBe(1_000n);
  });

  it('is zero when balanced', () => {
    expect(isBalanced(reconciliationDifference(9_000n, 6_000n, 3_000n))).toBe(true);
    expect(isBalanced(1n)).toBe(false);
    expect(isBalanced(-1n)).toBe(false);
  });

  it('balances a debt account with a negative opening and a negative statement balance', () => {
    expect(reconciliationDifference(-50_000n, clearedBalance(-50_000n, 0n), 0n)).toBe(0n);
  });

  it('with no ticked rows is the statement balance minus the opening', () => {
    expect(reconciliationDifference(12_000n, clearedBalance(10_000n, 0n), sumToBigInt(null))).toBe(2_000n);
  });

  it('keeps full precision near the 10^13 bound', () => {
    expect(reconciliationDifference(10_000_000_000_000n, 9_999_999_999_999n, 0n)).toBe(1n);
  });
});

describe('cleared balance across finish, undo and a second statement', () => {
  const opening = 10_000n;

  it('moves up on finish, back on undo, and accumulates for a second statement', () => {
    const beforeFinish = clearedBalance(opening, sumToBigInt(null));
    const afterFinish = clearedBalance(opening, sumToBigInt('3000'));
    const afterUndo = clearedBalance(opening, sumToBigInt(null));
    const afterSecond = clearedBalance(opening, sumToBigInt('3000') + sumToBigInt('-1200'));

    expect([beforeFinish, afterFinish, afterUndo, afterSecond]).toEqual([10_000n, 13_000n, 10_000n, 11_800n]);
  });

  it('makes the second statement start from the first one as its cleared balance', () => {
    const cleared = clearedBalance(opening, 3_000n);

    expect(reconciliationDifference(11_800n, cleared, -1_200n)).toBe(0n);
  });
});

describe('reconciliationStatus', () => {
  it('is open while reconciledAt is null and finished once set', () => {
    expect(reconciliationStatus(null)).toBe('open');
    expect(reconciliationStatus(new Date('2026-11-01T00:00:00Z'))).toBe('finished');
  });
});
