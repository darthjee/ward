import { chargePreset, paymentPreset } from '../../../../../../../../assets/js/components/resources/bank/providers/common/shortcutPresets.js';

describe('provider shortcut presets', () => {
  it('opens a charge (Out, "Charge") with the expected amount suggested', () => {
    expect(chargePreset({ expected_amount: '200.00' })).toEqual({ direction: 'out', description: 'Charge', amount: '200.00' });
  });

  it('opens a charge with an empty amount without an expected amount', () => {
    expect(chargePreset({ expected_amount: null })).toEqual({ direction: 'out', description: 'Charge', amount: '' });
    expect(chargePreset(null)).toEqual({ direction: 'out', description: 'Charge', amount: '' });
  });

  it('opens a payment (In, "Payment") with an empty amount', () => {
    expect(paymentPreset()).toEqual({ direction: 'in', description: 'Payment', amount: '' });
  });
});
