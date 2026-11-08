import {
  convertExponent,
  currencyExponent,
  formatAmount,
  InvalidAmountError,
  isSupportedCurrency,
  MAX_ABS_MINOR_UNITS,
  parseAmount,
} from '../currency.js';

describe('currency helpers', () => {
  describe('isSupportedCurrency', () => {
    it.each(['BRL', 'USD', 'JPY', 'BHD'])('accepts %s', (code) => {
      expect(isSupportedCurrency(code)).toBe(true);
    });

    it.each(['XYZ', 'brl', '', 'BRLX'])('rejects %p', (code) => {
      expect(isSupportedCurrency(code)).toBe(false);
    });
  });

  describe('currencyExponent', () => {
    it.each([
      ['BRL', 2],
      ['USD', 2],
      ['JPY', 0],
      ['BHD', 3],
    ])('returns the exponent of %s', (code, exponent) => {
      expect(currencyExponent(code)).toBe(exponent);
    });
  });

  describe('parseAmount', () => {
    it.each([
      ['-1234.56', 'BRL', -123456n],
      ['1234.5', 'BRL', 123450n],
      ['+7', 'BRL', 700n],
      ['0.01', 'BRL', 1n],
      ['500', 'JPY', 500n],
      ['-1.234', 'BHD', -1234n],
      ['0', 'BRL', 0n],
    ])('parses %s in %s', (value, currency, expected) => {
      expect(parseAmount(value, currency)).toBe(expected);
    });

    it.each([
      ['10.555', 'BRL'],
      ['1.5', 'JPY'],
      ['1.2345', 'BHD'],
    ])('rejects %s in %s (too many decimals)', (value, currency) => {
      expect(() => parseAmount(value, currency)).toThrow(InvalidAmountError);
    });

    it.each(['', 'abc', '1,5', '1.', '.5', '1e3', ' 1', '--1', '1'.repeat(40)])(
      'rejects the malformed value %p',
      (value) => {
        expect(() => parseAmount(value, 'BRL')).toThrow(InvalidAmountError);
      },
    );

    it('rejects a non-string value', () => {
      expect(() => parseAmount(12 as never, 'BRL')).toThrow(InvalidAmountError);
    });

    it('rejects zero when nonZero is requested', () => {
      expect(() => parseAmount('0.00', 'BRL', { nonZero: true })).toThrow('zero');
      expect(() => parseAmount('-0', 'BRL', { nonZero: true })).toThrow('zero');
    });

    it('accepts exactly 10^13 minor units in both signs', () => {
      expect(parseAmount('100000000000.00', 'BRL')).toBe(MAX_ABS_MINOR_UNITS);
      expect(parseAmount('-100000000000.00', 'BRL')).toBe(-MAX_ABS_MINOR_UNITS);
      expect(parseAmount('10000000000000', 'JPY')).toBe(MAX_ABS_MINOR_UNITS);
    });

    it('rejects one minor unit over 10^13 in both signs', () => {
      expect(() => parseAmount('100000000000.01', 'BRL')).toThrow('too large');
      expect(() => parseAmount('-100000000000.01', 'BRL')).toThrow('too large');
      expect(() => parseAmount('10000000000001', 'JPY')).toThrow('too large');
    });
  });

  describe('formatAmount', () => {
    it.each([
      [-123456n, 'BRL', '-1234.56'],
      [1n, 'BRL', '0.01'],
      [-5n, 'BRL', '-0.05'],
      [0n, 'BRL', '0.00'],
      [500n, 'JPY', '500'],
      [-500n, 'JPY', '-500'],
      [1234n, 'BHD', '1.234'],
      [MAX_ABS_MINOR_UNITS, 'BRL', '100000000000.00'],
    ])('formats %s in %s as %s', (minor, currency, expected) => {
      expect(formatAmount(minor, currency)).toBe(expected);
    });
  });

  describe('round trips', () => {
    it.each([
      ['-1234.56', 'BRL'],
      ['0.00', 'BRL'],
      ['500', 'JPY'],
      ['-1.234', 'BHD'],
      ['100000000000.00', 'BRL'],
      ['-100000000000.00', 'BRL'],
      ['10000000000000', 'JPY'],
    ])('parse then format keeps %s in %s', (value, currency) => {
      expect(formatAmount(parseAmount(value, currency), currency)).toBe(value);
    });
  });

  describe('convertExponent', () => {
    it.each([
      [100000n, 'BRL', 'JPY', 1000n],
      [1000n, 'JPY', 'BRL', 100000n],
      [-1000n, 'BHD', 'JPY', -1n],
    ])('converts %s from %s to %s', (minor, from, to, expected) => {
      expect(convertExponent(minor, from, to)).toBe(expected);
    });

    it('keeps the value between currencies with the same exponent', () => {
      expect(convertExponent(-123456n, 'BRL', 'USD')).toBe(-123456n);
    });

    it('rejects a value that loses decimals', () => {
      expect(() => convertExponent(12345n, 'BRL', 'JPY')).toThrow(InvalidAmountError);
      expect(() => convertExponent(-1234n, 'BHD', 'BRL')).toThrow(InvalidAmountError);
    });

    it('drops trailing zero decimals', () => {
      expect(convertExponent(-1230n, 'BHD', 'BRL')).toBe(-123n);
    });

    it('rejects a value that overflows once rescaled', () => {
      expect(() => convertExponent(MAX_ABS_MINOR_UNITS, 'JPY', 'BRL')).toThrow('too large');
    });
  });
});
