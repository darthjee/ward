import BankClient from '../../../../assets/js/client/BankClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

const CONTEXTS = [
  ['Personal', { kind: 'personal' }, ''],
  ['an organization', { kind: 'organization', orgId: 5 }, '/orgs/5'],
];

const ACCOUNT_ATTRS = {
  name: 'CDB',
  bank_name: 'Broker',
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '0',
  notes: null,
};

const INVESTMENT_ATTRS = {
  kind: 'fixed_income',
  yield_rate: '12.5',
  yield_period: 'yearly',
  maturity_date: '2028-01-01',
  liquidity_days: 30,
};

const FORBIDDEN = {
  user_id: 1, organization_id: 5, type: 'regular', id: 9, balance: '1',
};

describe('BankClient (investments)', () => {
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
      it('lists investment accounts', async () => {
        stub([{ id: 3 }]);

        expect(await BankClient.listAccounts(context, { type: 'investment', archived: true })).toEqual([{ id: 3 }]);
        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts.json?type=investment&archived=true`, method: 'GET', body: undefined,
        });
      });

      it('creates an investment with type investment and a whitelisted nested investment object', async () => {
        stub({ id: 3 }, 201);
        await BankClient.createInvestment(context, {
          ...ACCOUNT_ATTRS, ...FORBIDDEN, extra: 'x', investment: { ...INVESTMENT_ATTRS, account_id: 3, extra: 'y' },
        });

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts.json`,
          method: 'POST',
          body: { ...ACCOUNT_ATTRS, type: 'investment', investment: INVESTMENT_ATTRS },
        });
      });

      it('creates an investment without an investment object', async () => {
        stub({ id: 3 }, 201);
        await BankClient.createInvestment(context, { name: 'CDB', opening_balance: '0' });

        expect(lastCall().body).toEqual({ type: 'investment', name: 'CDB', opening_balance: '0' });
      });

      it('updates an investment with the nested object and never the type', async () => {
        stub({ id: 3 });
        await BankClient.updateInvestment(context, 3, {
          name: 'CDB', ...FORBIDDEN, investment: { liquidity_days: 0, unknown: 1, kind: undefined },
        });

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/3.json`, method: 'PATCH', body: { name: 'CDB', investment: { liquidity_days: 0 } },
        });
      });

      it('keeps null to clear the yield rate and period together', async () => {
        stub({ id: 3 });
        await BankClient.updateInvestment(context, 3, { investment: { yield_rate: null, yield_period: null } });

        expect(lastCall().body).toEqual({ investment: { yield_rate: null, yield_period: null } });
      });

      it('updates an investment without an investment object', async () => {
        stub({ id: 3 });
        await BankClient.updateInvestment(context, 3, { name: 'CDB', investment: null });

        expect(lastCall().body).toEqual({ name: 'CDB' });
      });

      it('strips type and investment from the generic account calls', async () => {
        stub({ id: 12 }, 201);
        await BankClient.createAccount(context, { name: 'Main', type: 'investment', investment: INVESTMENT_ATTRS });

        expect(lastCall().body).toEqual({ name: 'Main' });

        stub({ id: 12 });
        await BankClient.updateAccount(context, 12, { name: 'Main', type: 'investment', investment: INVESTMENT_ATTRS });

        expect(lastCall().body).toEqual({ name: 'Main' });
      });

      it('strips investment from the debt calls', async () => {
        stub({ id: 7 }, 201);
        await BankClient.createDebt(context, { name: 'Loan', investment: INVESTMENT_ATTRS });

        expect(lastCall().body).toEqual({ type: 'debt', name: 'Loan' });
      });
    });
  });

  it('sends only the type for missing attributes', async () => {
    stub({ id: 1 }, 201);
    await BankClient.createInvestment({ kind: 'personal' }, undefined);

    expect(lastCall().body).toEqual({ type: 'investment' });
  });
});
