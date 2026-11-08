import { mergeLoadedAccount } from '../../../../../../../../../assets/js/components/resources/bank/common/form/hooks/useAccountEditPage.js';

describe('useAccountEditPage', () => {
  describe('mergeLoadedAccount', () => {
    const account = { name: 'Loan', currency: 'BRL', opening_balance: '-10.00' };

    it('fills the form with the given fields builder on the first load', () => {
      const fieldsFrom = jasmine.createSpy('fieldsFrom').and.returnValue({ name: 'built' });

      expect(mergeLoadedAccount(null, account, false, fieldsFrom)).toEqual({ name: 'built' });
      expect(fieldsFrom).toHaveBeenCalledWith(account);
    });

    it('defaults to the common account fields', () => {
      expect(mergeLoadedAccount(null, account, false).opening_balance).toBe('-10.00');
    });
  });
});
