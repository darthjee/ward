import { buildBankConfig } from '../bank.config.js';

function fakeConfigService(values: Record<string, string | undefined>) {
  return { get: jest.fn((key: string) => values[key]) } as never;
}

describe('buildBankConfig', () => {
  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace-only', '   '],
  ])('defaults to BRL when BANK_DEFAULT_CURRENCY is %s', (_label, value) => {
    const config = buildBankConfig(fakeConfigService({ BANK_DEFAULT_CURRENCY: value }));

    expect(config).toEqual({ defaultCurrency: 'BRL' });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('trims the configured value', () => {
    const config = buildBankConfig(fakeConfigService({ BANK_DEFAULT_CURRENCY: '  USD ' }));

    expect(config.defaultCurrency).toBe('USD');
  });

  it('accepts a supported non-BRL code', () => {
    const config = buildBankConfig(fakeConfigService({ BANK_DEFAULT_CURRENCY: 'JPY' }));

    expect(config.defaultCurrency).toBe('JPY');
  });

  it.each(['XYZ', 'brl', 'BRLX'])('throws on the unsupported code %s', (code) => {
    const configService = fakeConfigService({ BANK_DEFAULT_CURRENCY: code });

    expect(() => buildBankConfig(configService)).toThrow('BANK_DEFAULT_CURRENCY');
  });
});
