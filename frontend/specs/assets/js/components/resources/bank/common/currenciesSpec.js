import {
  currencyOptions,
  filterCurrencies,
} from '../../../../../../../assets/js/components/resources/bank/common/currencies.js';
import DisplayLocale from '../../../../../../../assets/js/utils/locale/DisplayLocale.js';

function fakeIntl(codes, names) {
  return {
    supportedValuesOf: () => codes,
    DisplayNames: class {
      constructor(locale) {
        fakeIntl.lastLocale = locale;
      }

      of(code) {
        if (code === 'ERR') {
          throw new RangeError('bad');
        }

        return names[code];
      }
    },
  };
}

describe('currencies', () => {
  it('passes the display locale to DisplayNames', () => {
    DisplayLocale.set('pt-BR');
    currencyOptions('BRL', fakeIntl(['BRL'], {}));
    DisplayLocale.set(null);

    expect(fakeIntl.lastLocale).toBe('pt-BR');
  });

  const intl = fakeIntl(['USD', 'BRL', 'EUR', 'XXX', 'ERR'], {
    USD: 'US Dollar', BRL: 'Brazilian Real', EUR: 'Euro', XXX: 'XXX',
  });

  describe('currencyOptions', () => {
    it('puts the default first, then every other code A-Z', () => {
      expect(currencyOptions('EUR', intl).map(({ code }) => code))
        .toEqual(['EUR', 'BRL', 'ERR', 'USD', 'XXX']);
    });

    it('sorts A-Z without a default', () => {
      expect(currencyOptions(null, intl).map(({ code }) => code))
        .toEqual(['BRL', 'ERR', 'EUR', 'USD', 'XXX']);
    });

    it('ignores an unknown default', () => {
      expect(currencyOptions('ZZZ', intl)[0].code).toBe('BRL');
    });

    it('labels with code and name', () => {
      expect(currencyOptions('BRL', intl)[0])
        .toEqual({ code: 'BRL', name: 'Brazilian Real', label: 'BRL — Brazilian Real' });
    });

    it('falls back to the code when the name equals the code', () => {
      expect(currencyOptions(null, intl).find(({ code }) => code === 'XXX'))
        .toEqual({ code: 'XXX', name: 'XXX', label: 'XXX' });
    });

    it('falls back to the code when the name lookup throws', () => {
      expect(currencyOptions(null, intl).find(({ code }) => code === 'ERR').label).toBe('ERR');
    });

    it('falls back to the code without DisplayNames', () => {
      const bare = { supportedValuesOf: () => ['BRL'] };

      expect(currencyOptions('BRL', bare)).toEqual([{ code: 'BRL', name: 'BRL', label: 'BRL' }]);
    });

    it('falls back to the code when no name is available', () => {
      const noNames = fakeIntl(['ABC'], {});

      expect(currencyOptions(null, noNames)[0].label).toBe('ABC');
    });

    it('uses the real Intl by default', () => {
      const options = currencyOptions('BRL');

      expect(options[0].code).toBe('BRL');
      expect(options.map(({ code }) => code)).toContain('JPY');
    });
  });

  describe('filterCurrencies', () => {
    const options = currencyOptions('BRL', intl);

    it('returns everything for an empty filter', () => {
      expect(filterCurrencies(options, '  ')).toBe(options);
    });

    it('filters by code, case-insensitively', () => {
      expect(filterCurrencies(options, 'usd').map(({ code }) => code)).toEqual(['USD']);
    });

    it('filters by name, case-insensitively', () => {
      expect(filterCurrencies(options, 'REAL').map(({ code }) => code)).toEqual(['BRL']);
    });

    it('keeps the original order', () => {
      expect(filterCurrencies(options, 'r').map(({ code }) => code)).toEqual(['BRL', 'ERR', 'EUR', 'USD']);
    });

    it('returns nothing when no option matches', () => {
      expect(filterCurrencies(options, 'zzz')).toEqual([]);
    });
  });
});
