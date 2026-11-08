import {
  MAX_ABS_MINOR_UNITS,
  currencyDigits,
  formatMoney,
  fromSignedAmount,
  isZeroAmount,
  negateAmount,
  parseAmount,
  subtractAmounts,
  toSignedAmount,
} from '../../../../../../../assets/js/components/resources/bank/common/amounts.js';

const BRL = { currency: 'BRL' };

describe('amounts', () => {
  describe('currencyDigits', () => {
    [['BRL', 2], ['USD', 2], ['JPY', 0], ['BHD', 3]].forEach(([code, digits]) => {
      it(`reads ${digits} decimals for ${code}`, () => {
        expect(currencyDigits(code)).toBe(digits);
      });
    });
  });

  describe('parseAmount', () => {
    it('accepts . as the decimal separator', () => {
      expect(parseAmount('12.50', BRL)).toEqual({ value: '12.50' });
    });

    it('accepts , and normalises it to .', () => {
      expect(parseAmount('12,50', BRL)).toEqual({ value: '12.50' });
    });

    it('accepts an integer', () => {
      expect(parseAmount('12', BRL)).toEqual({ value: '12' });
    });

    it('trims the input', () => {
      expect(parseAmount('  7,5 ', BRL)).toEqual({ value: '7.5' });
    });

    it('accepts a trailing separator without decimals', () => {
      expect(parseAmount('12.', BRL)).toEqual({ value: '12' });
    });

    ['1.234,56', '1,234.56', '1.234.567', '12a', '', '  ', '.5', '+5', '1 000', '--1'].forEach((input) => {
      it(`rejects ${JSON.stringify(input)}`, () => {
        expect(parseAmount(input, BRL).error).toEqual(jasmine.any(String));
      });
    });

    it('rejects a missing input', () => {
      expect(parseAmount(undefined, BRL).error).toEqual(jasmine.any(String));
    });

    describe('decimals per currency', () => {
      it('accepts 2 decimals for BRL', () => {
        expect(parseAmount('1.23', BRL)).toEqual({ value: '1.23' });
      });

      it('rejects 3 decimals for BRL', () => {
        expect(parseAmount('1.234', BRL).error).toContain('2 decimal');
      });

      it('accepts no decimals for JPY', () => {
        expect(parseAmount('500', { currency: 'JPY' })).toEqual({ value: '500' });
      });

      it('rejects decimals for JPY', () => {
        expect(parseAmount('500.5', { currency: 'JPY' }).error).toContain('does not accept decimals');
      });

      it('accepts 3 decimals for BHD', () => {
        expect(parseAmount('1,234', { currency: 'BHD' })).toEqual({ value: '1.234' });
      });

      it('rejects 4 decimals for BHD', () => {
        expect(parseAmount('1.2345', { currency: 'BHD' }).error).toContain('3 decimal');
      });

      it('takes the input decimals when no currency is given', () => {
        expect(parseAmount('1.2345')).toEqual({ value: '1.2345' });
      });
    });

    describe('zero', () => {
      ['0', '0.00', '0,0'].forEach((input) => {
        it(`rejects ${input} for a transaction`, () => {
          expect(parseAmount(input, BRL).error).toContain('zero');
        });
      });

      it('accepts zero when allowed', () => {
        expect(parseAmount('0', { ...BRL, allowZero: true })).toEqual({ value: '0' });
      });
    });

    describe('sign', () => {
      it('rejects a negative amount by default', () => {
        expect(parseAmount('-5', BRL).error).toContain('positive');
      });

      it('accepts a negative opening balance', () => {
        expect(parseAmount('-1234,56', { ...BRL, allowNegative: true, allowZero: true }))
          .toEqual({ value: '-1234.56' });
      });
    });

    describe('the 10^13 minor-unit cap', () => {
      it('exposes the cap', () => {
        expect(MAX_ABS_MINOR_UNITS).toBe(10000000000000n);
      });

      it('accepts exactly the cap for BRL', () => {
        expect(parseAmount('100000000000.00', BRL)).toEqual({ value: '100000000000.00' });
      });

      it('rejects one minor unit over the cap for BRL', () => {
        expect(parseAmount('100000000000.01', BRL).error).toContain('too large');
      });

      it('accepts exactly the cap for JPY', () => {
        expect(parseAmount('10000000000000', { currency: 'JPY' })).toEqual({ value: '10000000000000' });
      });

      it('rejects over the cap for JPY', () => {
        expect(parseAmount('10000000000001', { currency: 'JPY' }).error).toContain('too large');
      });

      it('applies the cap to negative values', () => {
        expect(parseAmount('-100000000000.01', { ...BRL, allowNegative: true }).error)
          .toContain('too large');
      });

      it('keeps huge values exact without float rounding', () => {
        expect(parseAmount('99999999999.99', BRL)).toEqual({ value: '99999999999.99' });
      });
    });
  });

  describe('sign mapping', () => {
    it('maps out to a negative amount', () => {
      expect(toSignedAmount('out', '12.50')).toBe('-12.50');
    });

    it('maps in to a positive amount', () => {
      expect(toSignedAmount('in', '12.50')).toBe('12.50');
    });

    it('maps a negative stored amount to out with the absolute value', () => {
      expect(fromSignedAmount('-1234.56')).toEqual({ direction: 'out', value: '1234.56' });
    });

    it('maps a positive stored amount to in', () => {
      expect(fromSignedAmount('500')).toEqual({ direction: 'in', value: '500' });
    });

    it('maps a missing amount to in with an empty value', () => {
      expect(fromSignedAmount(undefined)).toEqual({ direction: 'in', value: '' });
    });

    it('round-trips', () => {
      const { direction, value } = fromSignedAmount('-7.25');

      expect(toSignedAmount(direction, value)).toBe('-7.25');
    });
  });

  describe('negateAmount', () => {
    it('negates a positive amount', () => {
      expect(negateAmount('10000.00')).toBe('-10000.00');
      expect(negateAmount('+5')).toBe('-5');
    });

    it('makes a negative amount positive', () => {
      expect(negateAmount('-10000.00')).toBe('10000.00');
    });

    it('keeps blank and zero values unchanged', () => {
      expect(negateAmount('')).toBe('');
      expect(negateAmount(null)).toBe('');
      expect(negateAmount(undefined)).toBe('');
      expect(negateAmount('0')).toBe('0');
      expect(negateAmount('0.00')).toBe('0.00');
      expect(negateAmount('-0')).toBe('-0');
    });

    it('trims the input', () => {
      expect(negateAmount(' 12.5 ')).toBe('-12.5');
    });
  });

  describe('formatMoney', () => {
    function expected(value, currency) {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
    }

    it('formats a decimal string in the given currency', () => {
      expect(formatMoney('-1234.56', 'BRL')).toBe(expected(-1234.56, 'BRL'));
    });

    it('formats JPY without decimals', () => {
      expect(formatMoney('500', 'JPY')).toBe(expected(500, 'JPY'));
    });

    it('formats BHD with 3 decimals', () => {
      expect(formatMoney('1.234', 'BHD')).toBe(expected(1.234, 'BHD'));
    });

    it('formats the cap exactly', () => {
      expect(formatMoney('100000000000.00', 'BRL')).toBe(expected(100000000000, 'BRL'));
    });

    it('returns empty for a missing value', () => {
      expect(formatMoney(null, 'BRL')).toBe('');
      expect(formatMoney(undefined, 'BRL')).toBe('');
      expect(formatMoney('', 'BRL')).toBe('');
    });
  });

  describe('subtractAmounts', () => {
    it('subtracts exactly in minor units', () => {
      expect(subtractAmounts('0.3', '0.1', 'BRL')).toBe('0.20');
    });

    it('returns a negative difference', () => {
      expect(subtractAmounts('950', '1000.00', 'BRL')).toBe('-50.00');
    });

    it('pads small differences with leading zeros', () => {
      expect(subtractAmounts('1000.05', '1000.00', 'BRL')).toBe('0.05');
      expect(subtractAmounts('1000.00', '1000.05', 'BRL')).toBe('-0.05');
    });

    it('returns zero without a sign', () => {
      expect(subtractAmounts('10,00', '10.00', 'BRL')).toBe('0.00');
    });

    it('handles negative operands', () => {
      expect(subtractAmounts('5', '-2.5', 'BRL')).toBe('7.50');
    });

    it('uses the currency decimals', () => {
      expect(subtractAmounts('1500', '1000', 'JPY')).toBe('500');
      expect(subtractAmounts('1.5', '0.25', 'BHD')).toBe('1.250');
    });

    it('stays exact at the cap', () => {
      expect(subtractAmounts('100000000000.00', '0.01', 'BRL')).toBe('99999999999.99');
    });

    it('reads a blank or malformed operand as zero', () => {
      expect(subtractAmounts('10', null, 'BRL')).toBe('10.00');
      expect(subtractAmounts('abc', '1', 'BRL')).toBe('-1.00');
    });
  });

  describe('isZeroAmount', () => {
    ['0', '0.00', '-0.0', '00,0'].forEach((value) => {
      it(`is true for ${value}`, () => {
        expect(isZeroAmount(value)).toBeTrue();
      });
    });

    ['0.01', '-1', '', null, 'abc'].forEach((value) => {
      it(`is false for ${value}`, () => {
        expect(isZeroAmount(value)).toBeFalse();
      });
    });
  });
});
