import AccountsClient from '../../../../assets/js/client/AccountsClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';
import ApiError from '../../../../assets/js/client/ApiError.js';
import AuthSession from '../../../../assets/js/client/AuthSession.js';

describe('AccountsClient public routes rejecting with a 401', () => {
  const rows = [
    ['.register', () => AccountsClient.register({
      username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
    })],
    ['.login', () => AccountsClient.login({ username: 'foo', password: 'wrong' })],
    ['.refresh', () => AccountsClient.refresh('old-refresh-token')],
  ];

  rows.forEach(([name, call]) => {
    describe(name, () => {
      let error;

      beforeEach(() => {
        error = new ApiError(401, 'Invalid username or password', 'UNAUTHORIZED');
        spyOn(ApiClient, 'postJson').and.rejectWith(error);
        spyOn(AuthSession, 'set');
        spyOn(AuthSession, 'clear');
      });

      it('rejects with the same ApiError', async () => {
        await expectAsync(call()).toBeRejectedWith(error);
      });

      it('never sets nor clears the stored refresh token', async () => {
        await call().catch(() => undefined);

        expect(AuthSession.set).not.toHaveBeenCalled();
        expect(AuthSession.clear).not.toHaveBeenCalled();
      });
    });
  });
});
