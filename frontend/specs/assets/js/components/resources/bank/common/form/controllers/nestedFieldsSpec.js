import {
  INT_MAX,
  PERIODS,
  changedNestedFields,
  integerIn,
  rateEntries,
  text,
} from '../../../../../../../../../assets/js/components/resources/bank/common/form/controllers/nestedFields.js';

const NAMES = { rate: 'yield_rate', period: 'yield_period', periodError: 'Choose the yield period' };

describe('nestedFields', () => {
  it('exposes the periods and the int range', () => {
    expect(PERIODS).toEqual(['monthly', 'yearly']);
    expect(INT_MAX).toBe(2147483647);
  });

  describe('text', () => {
    it('trims, and reads null as empty', () => {
      expect(text('  a ')).toBe('a');
      expect(text(null)).toBe('');
      expect(text(5)).toBe('5');
    });
  });

  describe('rateEntries', () => {
    it('clears both fields for an empty rate', () => {
      expect(rateEntries({ yield_rate: ' ', yield_period: 'monthly' }, NAMES))
        .toEqual({ errors: [], values: { yield_rate: null, yield_period: null } });
    });

    it('normalises the rate and keeps the period', () => {
      expect(rateEntries({ yield_rate: '1,5', yield_period: 'yearly' }, NAMES)).toEqual({
        errors: [['yield_rate', null], ['yield_period', null]],
        values: { yield_rate: '1.5', yield_period: 'yearly' },
      });
    });

    it('requires the period once a rate is entered, with the given message', () => {
      expect(rateEntries({ yield_rate: '1', yield_period: '' }, NAMES).errors)
        .toContain(['yield_period', 'Choose the yield period']);
    });

    ['101', '1.23456', 'abc', '-1'].forEach((rate) => {
      it(`rejects ${rate}`, () => {
        const { errors } = rateEntries({ yield_rate: rate, yield_period: 'monthly' }, NAMES);

        expect(errors[0]).toEqual(['yield_rate', 'Enter a rate between 0 and 100, with at most 4 decimals']);
      });
    });

    it('accepts 100 and 0', () => {
      expect(rateEntries({ yield_rate: '100', yield_period: 'monthly' }, NAMES).errors[0]).toEqual(['yield_rate', null]);
      expect(rateEntries({ yield_rate: '0', yield_period: 'monthly' }, NAMES).values.yield_rate).toBe('0');
    });
  });

  describe('integerIn', () => {
    it('returns null for an empty value', () => {
      expect(integerIn('', [0, 10], 'bad')).toEqual({ error: null, value: null });
    });

    it('accepts the bounds', () => {
      expect(integerIn('0', [0, INT_MAX], 'bad')).toEqual({ error: null, value: 0 });
      expect(integerIn(String(INT_MAX), [0, INT_MAX], 'bad')).toEqual({ error: null, value: INT_MAX });
    });

    ['-1', '1.5', 'x', '2147483648'].forEach((raw) => {
      it(`rejects ${raw}`, () => {
        expect(integerIn(raw, [0, INT_MAX], 'bad')).toEqual({ error: 'bad', value: null });
      });
    });
  });

  describe('changedNestedFields', () => {
    const original = { name: 'A', investment: { kind: 'fund', liquidity_days: 0 } };

    it('drops the nested key when nothing in it changed', () => {
      expect(changedNestedFields(original, original, 'investment')).toEqual({});
    });

    it('keeps the changed top-level and nested keys', () => {
      const body = { name: 'B', investment: { kind: 'fund', liquidity_days: 30 } };

      expect(changedNestedFields(body, original, 'investment')).toEqual({ name: 'B', investment: { liquidity_days: 30 } });
    });

    it('sends null to clear a nested field', () => {
      const body = { name: 'A', investment: { kind: null, liquidity_days: 0 } };

      expect(changedNestedFields(body, original, 'investment')).toEqual({ investment: { kind: null } });
    });

    it('handles a body without the nested key', () => {
      expect(changedNestedFields({ name: 'X' }, original, 'investment')).toEqual({ name: 'X' });
    });

    it('handles a missing original', () => {
      expect(changedNestedFields({ name: 'X', investment: { kind: 'fund' } }, undefined, 'investment'))
        .toEqual({ name: 'X', investment: { kind: 'fund' } });
    });
  });
});
