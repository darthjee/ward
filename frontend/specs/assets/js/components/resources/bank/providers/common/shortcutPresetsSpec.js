import {
  chargePreset, paymentPreset, providerShortcuts,
} from '../../../../../../../../assets/js/components/resources/bank/providers/common/shortcutPresets.js';

function recurringPage(bills, totalCount = bills.length) {
  return { provider_bills: bills, pagination: { page: 1, total_count: totalCount } };
}

const CHARGE = { direction: 'out', description: 'Charge' };

describe('provider shortcut presets', () => {
  describe('chargePreset', () => {
    it('suggests the expected amount of the single recurring bill', () => {
      expect(chargePreset(recurringPage([{ expected_amount: '200.00', kind: 'recurring' }])))
        .toEqual({ ...CHARGE, amount: '200.00' });
    });

    it('leaves the amount empty when the single recurring bill has none', () => {
      expect(chargePreset(recurringPage([{ expected_amount: null, kind: 'recurring' }]))).toEqual({ ...CHARGE, amount: '' });
    });

    it('leaves the amount empty without recurring bills (only one-off bills)', () => {
      expect(chargePreset(recurringPage([]))).toEqual({ ...CHARGE, amount: '' });
    });

    it('leaves the amount empty with several recurring bills', () => {
      expect(chargePreset(recurringPage([{ expected_amount: '200.00' }, { expected_amount: '50.00' }])))
        .toEqual({ ...CHARGE, amount: '' });
    });

    it('counts the recurring bills of every page', () => {
      expect(chargePreset(recurringPage([{ expected_amount: '200.00' }], 2))).toEqual({ ...CHARGE, amount: '' });
    });

    it('leaves the amount empty while not loaded', () => {
      expect(chargePreset(undefined)).toEqual({ ...CHARGE, amount: '' });
      expect(chargePreset(null)).toEqual({ ...CHARGE, amount: '' });
      expect(chargePreset({})).toEqual({ ...CHARGE, amount: '' });
    });

    it('tolerates a count of one without bills', () => {
      expect(chargePreset({ pagination: { total_count: 1 } })).toEqual({ ...CHARGE, amount: '' });
    });
  });

  it('opens a payment (In, "Payment") with an empty amount', () => {
    expect(paymentPreset()).toEqual({ direction: 'in', description: 'Payment', amount: '' });
  });

  describe('providerShortcuts', () => {
    it('builds Add charge then Add payment', () => {
      expect(providerShortcuts(recurringPage([{ expected_amount: '200.00' }]))).toEqual([
        ['Add charge', 'outline-danger', { ...CHARGE, amount: '200.00' }],
        ['Add payment', 'outline-success', { direction: 'in', description: 'Payment', amount: '' }],
      ]);
    });

    it('leaves the charge amount empty while not loaded', () => {
      expect(providerShortcuts(null)[0][2]).toEqual({ ...CHARGE, amount: '' });
    });
  });
});
