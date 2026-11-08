import type { INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { BankModule } from '../bank.module.js';
import { ALICE, buildBankTestApp, createAccount, send } from './support/build-bank-test-app.js';

jest.mock('../ledger.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));
jest.mock('../account-balances.query.js', () => jest.requireActual('./support/in-memory-ledger.query.js'));

describe('lazy BankModule (e2e)', () => {
  let app: INestApplication;

  const bankModuleCount = (): number =>
    [...app.get(ModulesContainer).values()].filter((moduleRef) => moduleRef.metatype === BankModule).length;

  beforeAll(async () => {
    ({ app } = await buildBankTestApp());
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
});
