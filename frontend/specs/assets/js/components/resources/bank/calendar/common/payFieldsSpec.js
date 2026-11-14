import { initialPayFields, validatePayFields } from '../../../../../../../../assets/js/components/resources/bank/calendar/common/payFields.js';

const OCC = {
  kind: 'provider', currency: 'BRL', expected_amount: '10.00', default_paying_account: { id: 4, name: 'Main' },
};
const OPTIONS = [['4', 'Main'], ['5', 'Other']];
const NOW = new Date(2026, 10, 14, 12);

describe('payFields', () => {
  describe('initialPayFields', () => {
    it('prefills amount, today, default account and the charge box', () => {
      expect(initialPayFields(OCC, OPTIONS, '2026-11-14')).toEqual({
        amount: '10.00', paid_on: '2026-11-14', paying_account_id: '4', record_charge: true,
      });
    });

    it('leaves the amount empty without an expected amount', () => {
      expect(initialPayFields({ ...OCC, expected_amount: null }, OPTIONS, '2026-11-14').amount).toEqual('');
    });

    it('leaves the account empty without a default', () => {
      expect(initialPayFields({ ...OCC, default_paying_account: null }, OPTIONS, '2026-11-14').paying_account_id).toEqual('');
    });

    it('leaves the account empty when the default is not offered (archived)', () => {
      expect(initialPayFields(OCC, [['5', 'Other']], '2026-11-14').paying_account_id).toEqual('');
    });
  });

  describe('validatePayFields', () => {
    const valid = {
      amount: '10,50', paid_on: '2026-11-14', paying_account_id: '4', record_charge: true,
    };

    it('builds the values', () => {
      expect(validatePayFields(valid, OCC, NOW)).toEqual({
        errors: {},
        values: { paid_on: '2026-11-14', amount: '10.50', paying_account_id: 4, record_charge: true },
      });
    });

    it('requires the amount', () => {
      expect(validatePayFields({ ...valid, amount: '' }, OCC, NOW).errors.amount).toEqual('Amount is required');
    });

    it('rejects a non-positive amount', () => {
      expect(validatePayFields({ ...valid, amount: '0' }, OCC, NOW).errors.amount).toBeDefined();
    });

    it('rejects a future date', () => {
      expect(validatePayFields({ ...valid, paid_on: '2026-11-15' }, OCC, NOW).errors.paid_on)
        .toEqual('Date cannot be in the future');
    });

    it('requires the date', () => {
      expect(validatePayFields({ ...valid, paid_on: '' }, OCC, NOW).errors.paid_on).toBeDefined();
    });

    it('requires the paying account', () => {
      const result = validatePayFields({ ...valid, paying_account_id: '' }, OCC, NOW);

      expect(result.errors.paying_account_id).toBeDefined();
      expect(result.values).toBeNull();
    });
  });
});
