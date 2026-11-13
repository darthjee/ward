import {
  ACCOUNTS_BASE, BILLS_BASE, DEBTS_BASE, INVESTMENTS_BASE, PROVIDERS_BASE, SECTION_BY_TYPE, TYPE_BY_SECTION,
} from '../../../../../../../assets/js/components/resources/bank/common/sections.js';

describe('bank sections', () => {
  it('defines the section bases', () => {
    expect(ACCOUNTS_BASE).toBe('/bank/accounts');
    expect(DEBTS_BASE).toBe('/bank/debts');
    expect(INVESTMENTS_BASE).toBe('/bank/investments');
    expect(PROVIDERS_BASE).toBe('/bank/providers');
    expect(BILLS_BASE).toBe('/bank/bills');
  });

  it('maps each account type to its section and back', () => {
    expect(SECTION_BY_TYPE.get('regular')).toBe('/bank/accounts');
    expect(SECTION_BY_TYPE.get('debt')).toBe('/bank/debts');
    expect(TYPE_BY_SECTION.get('/bank/accounts')).toBe('regular');
    expect(TYPE_BY_SECTION.get('/bank/debts')).toBe('debt');
    expect(SECTION_BY_TYPE.get('investment')).toBe('/bank/investments');
    expect(TYPE_BY_SECTION.get('/bank/investments')).toBe('investment');
    expect(SECTION_BY_TYPE.get('provider_expense')).toBe('/bank/providers');
    expect(TYPE_BY_SECTION.get('/bank/providers')).toBe('provider_expense');
    expect(SECTION_BY_TYPE.has('unknown')).toBeFalse();
  });
});
