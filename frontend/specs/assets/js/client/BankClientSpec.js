import BankClient from '../../../../assets/js/client/BankClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

const PERSONAL = { kind: 'personal' };
const ORG = { kind: 'organization', orgId: 5 };

const CONTEXTS = [
  ['Personal', PERSONAL, ''],
  ['an organization', ORG, '/orgs/5'],
];

const ACCOUNT_ATTRS = {
  name: 'Main',
  bank_name: 'Bank',
  branch: '001',
  account_number: '12345',
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '-10.50',
  notes: null,
};

const TRANSACTION_ATTRS = {
  date: '2026-01-02', amount: '-12.50', description: 'Coffee', notes: null,
};

const FORBIDDEN = { user_id: 1, organization_id: 5, type: 'debt', id: 9, balance: '1' };

describe('BankClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function stub(json = {}, status = 200) {
    globalThis.fetch = fetchSequence([{ ok: true, status, json }]);
  }

  function lastCall() {
    const [path, options] = globalThis.fetch.calls.mostRecent().args;

    return { path, method: options.method, body: 'body' in options ? JSON.parse(options.body) : undefined };
  }

  CONTEXTS.forEach(([label, context, prefix]) => {
    describe(`in ${label}`, () => {
      it('lists active regular accounts', async () => {
        stub([{ id: 1 }]);

        expect(await BankClient.listAccounts(context)).toEqual([{ id: 1 }]);
        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts.json?type=regular&archived=false`, method: 'GET', body: undefined,
        });
      });

      it('lists accounts including archived ones', async () => {
        stub([]);
        await BankClient.listAccounts(context, { archived: true });

        expect(lastCall().path).toBe(`${prefix}/bank/accounts.json?type=regular&archived=true`);
      });

      it('gets an account', async () => {
        stub({ id: 12 });

        expect(await BankClient.getAccount(context, 12)).toEqual({ id: 12 });
        expect(lastCall()).toEqual({ path: `${prefix}/bank/accounts/12.json`, method: 'GET', body: undefined });
      });

      it('creates an account with whitelisted snake_case fields', async () => {
        stub({ id: 12 }, 201);
        await BankClient.createAccount(context, { ...ACCOUNT_ATTRS, ...FORBIDDEN, extra: 'x' });

        expect(lastCall()).toEqual({ path: `${prefix}/bank/accounts.json`, method: 'POST', body: ACCOUNT_ATTRS });
      });

      it('updates an account, sending only the given fields', async () => {
        stub({ id: 12 });
        await BankClient.updateAccount(context, 12, { name: 'Renamed', ...FORBIDDEN });

        expect(lastCall()).toEqual({ path: `${prefix}/bank/accounts/12.json`, method: 'PATCH', body: { name: 'Renamed' } });
      });

      it('deletes an account', async () => {
        stub(undefined, 204);
        await BankClient.deleteAccount(context, 12);

        expect(lastCall()).toEqual({ path: `${prefix}/bank/accounts/12.json`, method: 'DELETE', body: undefined });
      });

      it('archives an account', async () => {
        stub({ id: 12 });
        await BankClient.archiveAccount(context, 12);

        expect(lastCall()).toEqual({ path: `${prefix}/bank/accounts/12/archive.json`, method: 'POST', body: {} });
      });

      it('unarchives an account', async () => {
        stub({ id: 12 });
        await BankClient.unarchiveAccount(context, 12);

        expect(lastCall()).toEqual({ path: `${prefix}/bank/accounts/12/unarchive.json`, method: 'POST', body: {} });
      });

      it('lists a ledger page', async () => {
        stub({ transactions: [] });
        await BankClient.listTransactions(context, 12, 3);

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/12/transactions.json?page=3`, method: 'GET', body: undefined,
        });
      });

      it('lists the first ledger page by default', async () => {
        stub({ transactions: [] });
        await BankClient.listTransactions(context, 12);

        expect(lastCall().path).toBe(`${prefix}/bank/accounts/12/transactions.json?page=1`);
      });

      it('creates a transaction with whitelisted fields', async () => {
        stub({ id: 3 }, 201);
        await BankClient.createTransaction(context, 12, { ...TRANSACTION_ATTRS, ...FORBIDDEN, account_id: 12 });

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/12/transactions.json`, method: 'POST', body: TRANSACTION_ATTRS,
        });
      });

      it('updates a transaction, keeping notes: null', async () => {
        stub({ id: 3 });
        await BankClient.updateTransaction(context, 12, 3, { notes: null, ...FORBIDDEN });

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/12/transactions/3.json`, method: 'PATCH', body: { notes: null },
        });
      });

      it('deletes a transaction', async () => {
        stub(undefined, 204);
        await BankClient.deleteTransaction(context, 12, 3);

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/12/transactions/3.json`, method: 'DELETE', body: undefined,
        });
      });

      it('gets the settings', async () => {
        stub({ default_currency: 'BRL' });

        expect(await BankClient.getSettings(context)).toEqual({ default_currency: 'BRL' });
        expect(lastCall()).toEqual({ path: `${prefix}/bank/settings.json`, method: 'GET', body: undefined });
      });
    });
  });

  it('sends an empty body for missing attributes', async () => {
    stub({ id: 1 });
    await BankClient.createAccount(PERSONAL, undefined);

    expect(lastCall().body).toEqual({});
  });
});
