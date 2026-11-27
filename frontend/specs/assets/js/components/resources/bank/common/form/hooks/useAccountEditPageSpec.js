import { editLocks, mergeLoadedAccount } from '../../../../../../../../../assets/js/components/resources/bank/common/form/hooks/useAccountEditPage.js';

describe('useAccountEditPage', () => {
  describe('editLocks', () => {
    const ledger = (count) => ({ pagination: { total_count: count } });
    const plain = { last_reconciliation: null, open_reconciliation_id: null };

    it('locks nothing for a fresh account without transactions', () => {
      expect(editLocks(plain, ledger(0))).toEqual({ currencyLocked: false, openingLocked: false, currencyLockReason: null });
    });

    it('locks only the currency when there are transactions', () => {
      expect(editLocks(plain, ledger(3))).toEqual({ currencyLocked: true, openingLocked: false, currencyLockReason: 'transactions' });
    });

    it('locks the currency and the opening fields with a finished statement, even without transactions', () => {
      const account = { ...plain, last_reconciliation: { statement_date: '2026-03-31' } };

      expect(editLocks(account, ledger(0))).toEqual({ currencyLocked: true, openingLocked: true, currencyLockReason: 'reconciled' });
    });

    it('locks both with an open statement only, even without transactions', () => {
      const account = { ...plain, open_reconciliation_id: 4 };

      expect(editLocks(account, ledger(0))).toEqual({ currencyLocked: true, openingLocked: true, currencyLockReason: 'reconciled' });
    });

    it('prefers the statement reason when there are also transactions', () => {
      const account = { ...plain, open_reconciliation_id: 4 };

      expect(editLocks(account, ledger(2)).currencyLockReason).toBe('reconciled');
    });
  });

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

    it('keeps the fields untouched on a reload with nothing locked', () => {
      const fields = { name: 'Typed' };

      expect(mergeLoadedAccount(fields, account, false)).toBe(fields);
    });

    it('resets the opening fields, through the fields builder, when they are locked', () => {
      const fieldsFrom = () => ({ opening_date: '2026-01-01', opening_balance: '10.00', name: 'built' });
      const fields = { name: 'Typed', currency: 'USD', opening_date: '2026-02-02', opening_balance: '99' };

      expect(mergeLoadedAccount(fields, account, true, fieldsFrom, true)).toEqual({
        name: 'Typed', currency: 'BRL', opening_date: '2026-01-01', opening_balance: '10.00',
      });
    });

    it('brings a debt opening balance back negated', () => {
      const debtFields = (loaded) => ({ opening_date: '2026-01-01', opening_balance: loaded.opening_balance.replace('-', '') });
      const merged = mergeLoadedAccount({ opening_balance: '1' }, account, false, debtFields, true);

      expect(merged.opening_balance).toBe('10.00');
    });

    it('resets only the date when the builder has no opening balance (investments)', () => {
      const fieldsFrom = () => ({ opening_date: '2026-01-01' });
      const merged = mergeLoadedAccount({ opening_date: '2026-02-02' }, account, false, fieldsFrom, true);

      expect(merged).toEqual({ opening_date: '2026-01-01' });
    });
  });
});
