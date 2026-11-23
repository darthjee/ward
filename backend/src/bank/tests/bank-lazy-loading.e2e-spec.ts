import type { INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { BankModule } from '../bank.module.js';
import { ALICE, ALICE_ORG, base, buildBankTestApp, createAccount, send } from './support/build-bank-test-app.js';
import { ORG_MEMBERS, seedOrgRoles } from './support/owner-matrix.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../reconciliation.query.js', () => jest.requireActual('./support/in-memory-reconciliation.query.js'));
jest.mock('../provider-bills-summary.query.js', () => jest.requireActual('./support/in-memory-provider-bills-summary.query.js'));

describe('lazy BankModule (e2e)', () => {
  let app: INestApplication;

  const bankModuleCount = (): number =>
    [...app.get(ModulesContainer).values()].filter((moduleRef) => moduleRef.metatype === BankModule).length;

  beforeAll(async () => {
    const built = await buildBankTestApp();
    ({ app } = built);
    seedOrgRoles(built.seedMembership);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('is not loaded at boot', () => {
    expect(bankModuleCount()).toBe(0);
  });

  it('is not loaded by the resident settings route, nor by a request rejected before the handler', async () => {
    await send(app, 'get', '/bank/settings.json', ALICE).expect(200);
    await send(app, 'get', '/bank/accounts/abc.json', ALICE).expect(404);

    expect(bankModuleCount()).toBe(0);
  });

  it('is loaded on the first bank request, and exactly once across routes', async () => {
    await send(app, 'get', '/bank/accounts.json', ALICE).expect(200);
    expect(bankModuleCount()).toBe(1);

    const account = await createAccount(app, ALICE, null);
    await send(app, 'get', `/bank/accounts/${account.id}.json`, ALICE).expect(200);
    await send(app, 'get', `/bank/accounts/${account.id}/transactions.json`, ALICE).expect(200);
    await send(app, 'post', `/bank/accounts/${account.id}/transactions.json`, ALICE, {
      date: '2026-01-02', amount: '1', description: 'x',
    }).expect(201);

    expect(bankModuleCount()).toBe(1);
  });

  describe('reconciliation routes', () => {
    // Runs in its own fresh app: the module count of the shared app above is already 1.
    let fresh: INestApplication;
    const countIn = (target: INestApplication): number =>
      [...target.get(ModulesContainer).values()].filter((moduleRef) => moduleRef.metatype === BankModule).length;

    beforeAll(async () => {
      const built = await buildBankTestApp();
      fresh = built.app;
      seedOrgRoles(built.seedMembership);
    }, 30_000);

    afterAll(async () => {
      await fresh.close();
    });

    it('does not load the module for a role 403 (undo by a user) nor for a ticks body 400 (51 ids)', async () => {
      const path = `${base(ALICE_ORG)}/accounts/1/reconciliations`;
      const user = ORG_MEMBERS.user;

      await send(fresh, 'post', `${path}/1/undo.json`, user, {}).expect(403);
      await send(fresh, 'delete', `${path}/1.json`, user).expect(403);
      await send(fresh, 'patch', `${path}/1/ticks.json`, ALICE, { tick: Array.from({ length: 51 }, (_v, i) => i + 1) }).expect(400);
      await send(fresh, 'get', `${path}.json?page=abc`, ALICE).expect(400);
      await send(fresh, 'get', `${base(null)}/accounts/abc/reconciliations.json`, ALICE).expect(404);

      expect(countIn(fresh)).toBe(0);
    });

    it('loads the module exactly once for reconciliation requests', async () => {
      const account = await createAccount(fresh, ALICE, null, { opening_date: '2026-01-01' });
      const path = `/bank/accounts/${account.id}/reconciliations`;

      await send(fresh, 'get', `${path}.json`, ALICE).expect(200);
      const statement = (await send(fresh, 'post', `${path}.json`, ALICE, { statement_date: '2026-02-28', statement_balance: '0' }).expect(201)).body.id;
      await send(fresh, 'get', `${path}/${statement}.json`, ALICE).expect(200);
      await send(fresh, 'post', `${path}/${statement}/finish.json`, ALICE, {}).expect(200);

      expect(countIn(fresh)).toBe(1);
    });
  });
});
