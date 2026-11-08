import {
  ACCOUNTS_BASE, DEBTS_BASE, SECTION_BY_TYPE, TYPE_BY_SECTION,
} from '../../../../../../../assets/js/components/resources/bank/common/sections.js';

describe('bank sections', () => {
  it('defines the section bases', () => {
    expect(ACCOUNTS_BASE).toBe('/bank/accounts');
    expect(DEBTS_BASE).toBe('/bank/debts');
  });

  it('maps each account type to its section and back', () => {
    expect(SECTION_BY_TYPE.get('regular')).toBe('/bank/accounts');
    expect(SECTION_BY_TYPE.get('debt')).toBe('/bank/debts');
    expect(TYPE_BY_SECTION.get('/bank/accounts')).toBe('regular');
    expect(TYPE_BY_SECTION.get('/bank/debts')).toBe('debt');
    expect(SECTION_BY_TYPE.has('investment')).toBeFalse();
  });
});
