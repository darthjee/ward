import { ACCOUNTS_BASE, DEBTS_BASE } from '../../../../../../../assets/js/components/resources/bank/common/sections.js';

describe('bank sections', () => {
  it('defines the section bases', () => {
    expect(ACCOUNTS_BASE).toBe('/bank/accounts');
    expect(DEBTS_BASE).toBe('/bank/debts');
  });
});
