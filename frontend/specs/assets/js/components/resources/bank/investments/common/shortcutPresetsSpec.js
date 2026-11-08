import { applicationPreset, withdrawalPreset } from '../../../../../../../../assets/js/components/resources/bank/investments/common/shortcutPresets.js';
import { validateLedgerValues } from '../../../../../../../../assets/js/components/resources/bank/common/detail/controllers/ledgerFormFields.js';

const NOW = new Date(2026, 4, 10, 12);

describe('investment shortcut presets', () => {
  it('opens an application: In, "Application", empty amount', () => {
    expect(applicationPreset()).toEqual({ direction: 'in', description: 'Application', amount: '' });
  });

  it('opens a withdrawal: Out, "Withdrawal", empty amount', () => {
    expect(withdrawalPreset()).toEqual({ direction: 'out', description: 'Withdrawal', amount: '' });
  });

  it('posts an application typed positive as a positive amount', () => {
    const { body } = validateLedgerValues({ ...applicationPreset(), date: '2026-05-10', amount: '1000' }, { currency: 'BRL', now: NOW });

    expect(body).toEqual({ date: '2026-05-10', amount: '1000', description: 'Application' });
  });

  it('posts a withdrawal typed positive as a negative amount', () => {
    const { body } = validateLedgerValues({ ...withdrawalPreset(), date: '2026-05-10', amount: '250,50' }, { currency: 'BRL', now: NOW });

    expect(body).toEqual({ date: '2026-05-10', amount: '-250.50', description: 'Withdrawal' });
  });

  it('rejects a negative typed amount', () => {
    const { errors } = validateLedgerValues({ ...withdrawalPreset(), date: '2026-05-10', amount: '-5' }, { currency: 'BRL', now: NOW });

    expect(errors.amount).toEqual(jasmine.any(String));
  });
});
