import type { INestApplication } from '@nestjs/common';
import {
  ADMIN,
  ALICE,
  ALICE_ORG,
  BOB_ORG,
  buildBankTestApp,
  send,
  withoutTimestamp,
} from './support/build-bank-test-app.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));

describe('bank settings route (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await buildBankTestApp({ BANK_DEFAULT_CURRENCY: 'USD' }));
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('returns the same default currency under both prefixes', async () => {
    const personal = await send(app, 'get', '/bank/settings.json', ALICE).expect(200);
    const organization = await send(app, 'get', `/orgs/${ALICE_ORG}/bank/settings.json`, ALICE).expect(200);

    expect(personal.body).toEqual({ default_currency: 'USD' });
    expect(organization.body).toEqual(personal.body);
  });

  it('applies the configured default currency on create', async () => {
    const response = await send(app, 'post', '/bank/accounts.json', ALICE, { name: 'Default currency' }).expect(201);

    expect(response.body).toMatchObject({ currency: 'USD', opening_balance: '0.00' });
  });

  it('answers the uniform 404 to a non-member :orgId and a non-member global admin', async () => {
    const nonMember = await send(app, 'get', `/orgs/${BOB_ORG}/bank/settings.json`, ALICE).expect(404);
    const admin = await send(app, 'get', `/orgs/${ALICE_ORG}/bank/settings.json`, ADMIN, undefined, true).expect(404);

    expect(withoutTimestamp(nonMember)).toEqual({ error: { code: 'NOT_FOUND', message: 'Not Found' }, statusCode: 404 });
    expect(withoutTimestamp(admin)).toEqual(withoutTimestamp(nonMember));
  });

  it('is user-scoped and sends X-Skip-Cache', async () => {
    const response = await send(app, 'get', '/bank/settings.json', ALICE).expect(200);

    expect(response.headers['x-skip-cache']).toBe('true');
    expect(response.headers['cache-control']).toBe('private, no-store');
  });
});

describe('bank settings boot validation', () => {
  it('fails startup on an unsupported BANK_DEFAULT_CURRENCY', async () => {
    await expect(buildBankTestApp({ BANK_DEFAULT_CURRENCY: 'XYZ' })).rejects.toThrow('BANK_DEFAULT_CURRENCY');
  }, 30_000);
});
