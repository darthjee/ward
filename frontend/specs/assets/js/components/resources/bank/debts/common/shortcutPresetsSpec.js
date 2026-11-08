import { interestPreset, paymentPreset } from '../../../../../../../../assets/js/components/resources/bank/debts/common/shortcutPresets.js';

describe('shortcutPresets', () => {
  it('presets a payment as In, "Payment", suggesting the instalment amount', () => {
    expect(paymentPreset({ instalment_amount: '500.00' })).toEqual({ direction: 'in', description: 'Payment', amount: '500.00' });
  });

  it('presets a payment without amount when no instalment amount is set', () => {
    expect(paymentPreset({ instalment_amount: null })).toEqual({ direction: 'in', description: 'Payment', amount: '' });
    expect(paymentPreset(null)).toEqual({ direction: 'in', description: 'Payment', amount: '' });
  });

  it('presets interest as Out, "Interest", with an empty amount', () => {
    expect(interestPreset()).toEqual({ direction: 'out', description: 'Interest', amount: '' });
  });
});
