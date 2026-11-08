import { currentHash, navigate } from '../../../../../../../assets/js/components/resources/bank/common/currentHash.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';

describe('currentHash / navigate', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  it('reads an empty hash outside the browser', () => {
    expect(currentHash()).toBe('');
  });

  it('ignores navigation outside the browser', () => {
    expect(() => navigate('#/x')).not.toThrow();
  });

  it('reads and sets window.location.hash', () => {
    const fake = installFakeWindow({ location: { hash: '#/bank/accounts' } });

    expect(currentHash()).toBe('#/bank/accounts');

    navigate('#/bank/accounts/new');

    expect(fake.location.hash).toBe('#/bank/accounts/new');
  });
});
