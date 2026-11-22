import ApiClient from '../../../../assets/js/client/ApiClient.js';
import ApiError from '../../../../assets/js/client/ApiError.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';
import LoginModalEvents from '../../../../assets/js/client/LoginModalEvents.js';
import { installFakeWindow, uninstallFakeWindow } from '../../../support/fakeWindow.js';
import { stubRefreshFlow } from '../../../support/fetchSequence.js';

const UNAUTHORIZED_BODY = {
  error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' },
  statusCode: 401,
  timestamp: '2026-09-28T12:00:00.000Z',
};

describe('ApiClient with skipAuthRecovery', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    installFakeWindow({ location: { hash: '' } });
    spyOn(LoginModalEvents, 'open');
    stubRefreshFlow([{ ok: false, status: 401, json: UNAUTHORIZED_BODY }]);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    uninstallFakeWindow();
  });

  const verbs = [
    ['getJson', 'GET', (options) => ApiClient.getJson('/things.json', options)],
    ['postJson', 'POST', (options) => ApiClient.postJson('/things.json', { a: 1 }, options)],
    ['deleteJson', 'DELETE', (options) => ApiClient.deleteJson('/things.json', { a: 1 }, options)],
    ['patchJson', 'PATCH', (options) => ApiClient.patchJson('/things.json', { a: 1 }, options)],
  ];

  verbs.forEach(([name, method, call]) => {
    describe(`.${name}`, () => {
      it('rejects with the 401 ApiError carrying the body code and message', async () => {
        await expectAsync(call({ skipAuthRecovery: true })).toBeRejectedWith(jasmine.objectContaining({
          status: 401, code: 'UNAUTHORIZED', message: 'Invalid username or password',
        }));
      });

      it('does not mark the error as a session expiry', async () => {
        let caught;

        try {
          await call({ skipAuthRecovery: true });
        } catch (error) {
          caught = error;
        }

        expect(caught instanceof ApiError).toBe(true);
        expect(caught.sessionExpired).toBe(false);
      });

      it('makes a single request, with no refresh and no session change', async () => {
        await call({ skipAuthRecovery: true }).catch(() => undefined);

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch.calls.argsFor(0)[1].method).toBe(method);
        expect(AuthSession.get).not.toHaveBeenCalled();
        expect(AuthSession.set).not.toHaveBeenCalled();
        expect(AuthSession.clear).not.toHaveBeenCalled();
        expect(LoginModalEvents.open).not.toHaveBeenCalled();
      });
    });
  });
});
