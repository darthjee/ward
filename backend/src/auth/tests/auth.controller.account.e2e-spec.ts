import request from 'supertest';
import { loginAs, loginCookie, registerUser, useTestApp } from './auth.controller.e2e-test-support.js';
import { expectErrorBody, expectValidationErrorBody } from './support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';

describe('AuthController (e2e)', () => {
  const ctx = useTestApp();

  describe('GET /auth/account.json', () => {
    it('returns the caller own fields only, with X-Skip-Cache', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await request(ctx.app.getHttpServer())
        .get('/auth/account.json')
        .set('Cookie', [cookie])
        .expect(200);

      expect(response.body).toEqual({ username: 'darthjee', email: 'darthjee@example.com', locale: null });
      expect(response.headers['x-skip-cache']).toBe('true');
    });

    it('rejects an unauthenticated request', async () => {
      await request(ctx.app.getHttpServer()).get('/auth/account.json').expect(401);
    });
  });

  describe('PATCH /auth/account.json', () => {
    function patchAccount(cookie: string, body: Record<string, unknown>): request.Test {
      return request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .set('Cookie', [cookie])
        .send(body);
    }

    it('rejects an unauthenticated request', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/auth/account.json')
        .send({ currentPassword: 'my-password', username: 'new-username' })
        .expect(401);
    });

    describe('with the right current password', () => {
      let response: request.Response;

      beforeEach(async () => {
        const cookie = await loginCookie(ctx.app);

        response = await patchAccount(cookie, {
          currentPassword: 'my-password',
          username: 'new-username',
        }).expect(200);
      });

      it('updates the username and responds with { username, email }', () => {
        expect(response.body).toEqual({ username: 'new-username', email: 'darthjee@example.com', locale: null });
      });

      it('sets the X-Skip-Cache header', () => {
        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });

    describe('with a locale', () => {
      it('saves a locale-only change, and a following GET returns it', async () => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { locale: 'pt-BR' }).expect(200);
        const getResponse = await request(ctx.app.getHttpServer()).get('/auth/account.json').set('Cookie', [cookie]);

        expect(response.body).toEqual({ username: 'darthjee', email: 'darthjee@example.com', locale: 'pt-BR' });
        expect(response.headers['x-skip-cache']).toBe('true');
        expect(getResponse.body.locale).toBe('pt-BR');
      });

      it('resets the locale with null', async () => {
        const cookie = await loginCookie(ctx.app);
        await patchAccount(cookie, { locale: 'pt-BR' }).expect(200);

        const response = await patchAccount(cookie, { locale: null }).expect(200);

        expect(response.body.locale).toBeNull();
      });

      it.each(['pt-br', 'xx-XX', '', 1, {}])('answers %p with 422 INVALID_LOCALE', async (locale) => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { locale });

        expectErrorBody(response, {
          status: 422,
          code: ErrorCodes.INVALID_LOCALE,
          message: 'Unsupported display locale',
        });
        expect(response.headers['x-skip-cache']).toBe('true');
      });
    });

    it('rejects the wrong current password without changing the account', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await patchAccount(cookie, { currentPassword: 'wrong-password', username: 'new-username' });

      expectErrorBody(response, { status: 400, code: ErrorCodes.BAD_REQUEST, message: 'Invalid current password' });
      expect(ctx.userRepo.rows[0].username).toBe('darthjee');
    });

    it('answers a missing current password with 400 VALIDATION_FAILED', async () => {
      const cookie = await loginCookie(ctx.app);

      const response = await patchAccount(cookie, { username: 'new-username' });

      expectValidationErrorBody(response);
      expect(response.body.error.details).toContain('currentPassword should not be empty');
    });

    describe('when the new username/email belongs to another user', () => {
      beforeEach(async () => {
        await registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com' });
      });

      it('answers a taken username with 409 USERNAME_TAKEN', async () => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { currentPassword: 'my-password', username: 'obi-wan' });

        expectErrorBody(response, {
          status: 409,
          code: ErrorCodes.USERNAME_TAKEN,
          message: 'Username already in use',
        });
        expect(ctx.userRepo.rows[0].username).toBe('darthjee');
      });

      it('answers a taken email with 409 EMAIL_TAKEN', async () => {
        const cookie = await loginCookie(ctx.app);

        const response = await patchAccount(cookie, { currentPassword: 'my-password', email: 'obi-wan@example.com' });

        expectErrorBody(response, {
          status: 409,
          code: ErrorCodes.EMAIL_TAKEN,
          message: 'Email already in use',
        });
        expect(ctx.userRepo.rows[0].email).toBe('darthjee@example.com');
      });
    });

    it('does not revoke the caller\'s other refresh tokens on a successful password change', async () => {
      const login = await loginAs(ctx.app);
      const accessTokenCookie = login.headers['set-cookie'][0].split(';')[0];

      await patchAccount(accessTokenCookie, {
        currentPassword: 'my-password',
        newPassword: 'brand-new-password',
      }).expect(200);

      await request(ctx.app.getHttpServer())
        .post('/auth/refresh.json')
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);
    });

    it(
      'locks the account out with 423 after 5 failed attempts, even with the right password',
      async () => {
        const cookie = await loginCookie(ctx.app);

        for (let i = 0; i < 5; i += 1) {
          await patchAccount(cookie, { currentPassword: 'wrong-password', username: 'new-username' })
            .expect(400);
        }

        const response = await patchAccount(cookie, { currentPassword: 'my-password', username: 'new-username' });

        expectErrorBody(response, {
          status: 423,
          code: ErrorCodes.LOCKED,
          message: 'Account temporarily locked due to too many failed attempts',
        });
      },
      15000,
    );
  });
});
