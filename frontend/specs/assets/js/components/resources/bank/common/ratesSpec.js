import { formatInstalment, formatRate } from '../../../../../../../assets/js/components/resources/bank/common/rates.js';
import { formatMoney } from '../../../../../../../assets/js/components/resources/bank/common/amounts.js';

import DisplayLocale from '../../../../../../../assets/js/utils/locale/DisplayLocale.js';

describe('rates', () => {
  afterEach(() => {
    DisplayLocale.set(null);
  });

  describe('formatRate', () => {
    it('shows the rate as returned, with its period', () => {
      expect(formatRate('1.99', 'monthly')).toBe('1.99% / month');
      expect(formatRate('12.5', 'yearly')).toBe('12.5% / year');
      expect(formatRate('0', 'monthly')).toBe('0% / month');
    });

    it('shows the rate alone without a known period', () => {
      expect(formatRate('3', null)).toBe('3%');
    });

    it('formats in the display locale keeping precision', () => {
      DisplayLocale.set('pt-BR');
      const pt = [formatRate('1.5', null), formatRate('12.345', 'yearly'), formatRate('3', null)];
      DisplayLocale.set('en-US');
      const en = [formatRate('1.5', null), formatRate('12.345', 'yearly'), formatRate('3', null)];

      expect([pt, en]).toEqual([
        ['1,5%', '12,345% / year', '3%'],
        ['1.5%', '12.345% / year', '3%'],
      ]);
    });

    it('is empty without a rate', () => {
      expect(formatRate(null, null)).toBe('');
      expect(formatRate(undefined, 'monthly')).toBe('');
      expect(formatRate('', 'monthly')).toBe('');
    });
  });

  describe('formatInstalment', () => {
    it('formats the amount in the currency, with its frequency', () => {
      expect(formatInstalment('500.00', 'monthly', 'BRL')).toBe(`${formatMoney('500.00', 'BRL')} / month`);
      expect(formatInstalment('1200', 'yearly', 'JPY')).toBe(`${formatMoney('1200', 'JPY')} / year`);
    });

    it('shows the amount alone without a frequency', () => {
      expect(formatInstalment('500.00', null, 'BRL')).toBe(formatMoney('500.00', 'BRL'));
    });

    it('is empty without an amount', () => {
      expect(formatInstalment(null, 'monthly', 'BRL')).toBe('');
    });
  });
});
