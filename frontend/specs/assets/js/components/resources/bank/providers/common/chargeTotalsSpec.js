import { chargeCount, totalsByCurrency } from '../../../../../../../../assets/js/components/resources/bank/providers/common/chargeTotals.js';

function charge(amount, currency) {
  return { id: amount, amount, account: { currency } };
}

describe('chargeTotals', () => {
  describe('totalsByCurrency', () => {
    it('sums per currency, never across currencies, ordered by code', () => {
      expect(totalsByCurrency([
        charge('-10.10', 'USD'), charge('-0.10', 'BRL'), charge('-0.20', 'BRL'), charge('-1500', 'JPY'), charge('-5', 'USD'),
      ])).toEqual([
        { currency: 'BRL', total: '-0.30' },
        { currency: 'JPY', total: '-1500' },
        { currency: 'USD', total: '-15.10' },
      ]);
    });

    it('returns no totals for no charges', () => {
      expect(totalsByCurrency([])).toEqual([]);
      expect(totalsByCurrency(null)).toEqual([]);
    });
  });

  describe('chargeCount', () => {
    it('counts in words', () => {
      expect(chargeCount(1)).toBe('1 charge');
      expect(chargeCount(3)).toBe('3 charges');
      expect(chargeCount(0)).toBe('0 charges');
    });
  });
});
