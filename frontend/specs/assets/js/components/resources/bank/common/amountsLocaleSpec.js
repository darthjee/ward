import {
  formatMoney,
  parseAmount,
} from '../../../../../../../assets/js/components/resources/bank/common/amounts.js';
import DisplayLocale from '../../../../../../../assets/js/utils/locale/DisplayLocale.js';

const BRL = { currency: 'BRL' };

describe('amounts with a display locale', () => {
  afterEach(() => {
    DisplayLocale.set(null);
  });

  it('formats in pt-BR', () => {
    DisplayLocale.set('pt-BR');

    expect(formatMoney('1234.56', 'BRL').replace(/\u00a0/g, ' ')).toBe('R$ 1.234,56');
  });

  it('formats in en-US', () => {
    DisplayLocale.set('en-US');

    expect(formatMoney('1234.56', 'USD')).toBe('$1,234.56');
  });

  it('still parses both separators', () => {
    DisplayLocale.set('pt-BR');
    const a = parseAmount('1234.56', BRL);
    DisplayLocale.set('en-US');
    const b = parseAmount('1234,56', BRL);

    expect(a).toEqual(b);
  });
});
