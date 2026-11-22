import LoginModalController from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginModalController.js';
import { USER_DENIED_MESSAGE } from '../../../../../../../assets/js/components/common/loginModal/controllers/LoginErrorMessages.js';
import AccountsClient from '../../../../../../../assets/js/client/AccountsClient.js';
import AuthEvents from '../../../../../../../assets/js/client/AuthEvents.js';
import AuthSession from '../../../../../../../assets/js/client/AuthSession.js';
import LoginModalEvents from '../../../../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { stubRefreshFlow } from '../../../../../../support/fetchSequence.js';

const WRONG_PASSWORD_MESSAGE = 'Invalid username or password';

const errorBody = (statusCode, code, message) => ({
  error: { code, message }, statusCode, timestamp: '2026-09-28T12:00:00.000Z',
});

describe('LoginModalController login through the real AccountsClient', () => {
  let originalFetch;
  let setSubmitError;

  const passwordFields = { username: 'foo', password: 'wrong' };

  const build = () => {
    const noop = jasmine.createSpy('noop');

    return new LoginModalController(noop, noop, noop, setSubmitError, noop, noop, AccountsClient);
  };

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    setSubmitError = jasmine.createSpy('setSubmitError');
    installFakeWindow({ location: { hash: '' } });
    spyOn(AuthEvents, 'emit');
    spyOn(LoginModalEvents, 'open');
    spyOn(LoginModalEvents, 'close');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    uninstallFakeWindow();
  });

  const expectNoSessionChange = () => {
    expect(AuthSession.set).not.toHaveBeenCalled();
    expect(AuthSession.clear).not.toHaveBeenCalled();
    expect(LoginModalEvents.open).not.toHaveBeenCalled();
    expect(LoginModalEvents.close).not.toHaveBeenCalled();
    expect(AuthEvents.emit).not.toHaveBeenCalled();
  };

  describe('with a wrong password and no stored refresh token', () => {
    beforeEach(() => {
      stubRefreshFlow([
        { ok: false, status: 401, json: errorBody(401, 'UNAUTHORIZED', WRONG_PASSWORD_MESSAGE) },
      ], { refreshToken: null });
    });

    it('shows the 401 message without throwing', async () => {
      await expectAsync(build().handleSubmit('password', passwordFields)).toBeResolved();

      expect(setSubmitError).toHaveBeenCalledWith(WRONG_PASSWORD_MESSAGE);
    });

    it('makes a single request and leaves the session and modal alone', async () => {
      await build().handleSubmit('password', passwordFields);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch.calls.argsFor(0)[0]).toBe('/auth/login.json');
      expectNoSessionChange();
    });
  });

  describe('with a wrong password and a valid stored refresh token', () => {
    beforeEach(() => {
      stubRefreshFlow([
        { ok: false, status: 401, json: errorBody(401, 'UNAUTHORIZED', WRONG_PASSWORD_MESSAGE) },
      ]);
    });

    it('shows the 401 message', async () => {
      await build().handleSubmit('password', passwordFields);

      expect(setSubmitError).toHaveBeenCalledWith(WRONG_PASSWORD_MESSAGE);
    });

    it('never requests a refresh, rotates nor clears the stored token', async () => {
      await build().handleSubmit('password', passwordFields);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch.calls.argsFor(0)[0]).toBe('/auth/login.json');
      expectNoSessionChange();
    });
  });

  describe('when login answers 403 USER_DENIED', () => {
    it('shows the denied-account message', async () => {
      stubRefreshFlow([
        { ok: false, status: 403, json: errorBody(403, 'USER_DENIED', 'backend wording') },
      ]);

      await build().handleSubmit('password', passwordFields);

      expect(setSubmitError).toHaveBeenCalledWith(USER_DENIED_MESSAGE);
      expectNoSessionChange();
    });
  });
});
