import AccountsClient from '../../../../../assets/js/client/AccountsClient.js';
import AuthEvents from '../../../../../assets/js/client/AuthEvents.js';
import DisplayLocale from '../../../../../assets/js/utils/locale/DisplayLocale.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../support/fakeWindow.js';
import DisplayLocaleLoader from '../../../../../assets/js/utils/locale/DisplayLocaleLoader.js';

const flush = () => new Promise((resolve) => { setTimeout(resolve, 0); });

describe('DisplayLocaleLoader', () => {
  beforeEach(() => {
    installFakeWindow(new EventTarget());
    DisplayLocaleLoader.start();
  });

  afterEach(() => {
    DisplayLocaleLoader.stop();
    DisplayLocale.set(null);
    uninstallFakeWindow();
  });

  it('sets the account locale on login', async () => {
    spyOn(AccountsClient, 'getAccount').and.resolveTo({ locale: 'pt-BR' });
    AuthEvents.emit(true);
    await flush();

    expect(DisplayLocale.get()).toBe('pt-BR');
  });

  it('clears the locale on logout', async () => {
    DisplayLocale.set('pt-BR');
    AuthEvents.emit(false);

    expect(DisplayLocale.get()).toBeUndefined();
  });

  it('ignores a late response after logout', async () => {
    let resolve;
    spyOn(AccountsClient, 'getAccount').and.returnValue(new Promise((r) => { resolve = r; }));
    AuthEvents.emit(true);
    AuthEvents.emit(false);
    resolve({ locale: 'pt-BR' });
    await flush();

    expect(DisplayLocale.get()).toBeUndefined();
  });

  it('keeps the default when the GET fails', async () => {
    spyOn(AccountsClient, 'getAccount').and.rejectWith(new Error('boom'));
    AuthEvents.emit(true);
    await flush();

    expect(DisplayLocale.get()).toBeUndefined();
  });
});
