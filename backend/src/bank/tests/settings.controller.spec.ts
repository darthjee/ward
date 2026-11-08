import { SettingsController } from '../settings.controller.js';

describe('SettingsController', () => {
  it('returns the configured default currency', () => {
    expect(new SettingsController({ defaultCurrency: 'JPY' }).show()).toEqual({ default_currency: 'JPY' });
  });
});
