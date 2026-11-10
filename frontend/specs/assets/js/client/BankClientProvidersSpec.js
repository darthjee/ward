import BankClient from '../../../../assets/js/client/BankClient.js';
import { fetchSequence } from '../../../support/fetchSequence.js';

const CONTEXTS = [
  ['Personal', { kind: 'personal' }, ''],
  ['an organization', { kind: 'organization', orgId: 5 }, '/orgs/5'],
];

const ACCOUNT_ATTRS = {
  name: 'Office rent',
  bank_name: 'Landlord Ltd',
  branch: null,
  account_number: 'C-123',
  currency: 'BRL',
  opening_date: '2026-01-01',
  opening_balance: '0',
  notes: null,
};

const PROVIDER_ATTRS = {
  for_accountant: true,
  provider_tax_id: '12.345.678/0001-90',
  expected_amount: '200.00',
  charge_frequency: 'monthly',
  due_day: 10,
  due_month: null,
};

const FORBIDDEN = {
  user_id: 1, organization_id: 5, type: 'regular', id: 9, balance: '1',
};

describe('BankClient (provider expenses)', () => {
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
      it('lists provider-expense accounts', async () => {
        stub([{ id: 3 }]);

        expect(await BankClient.listAccounts(context, { type: 'provider_expense', archived: false })).toEqual([{ id: 3 }]);
        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts.json?type=provider_expense&archived=false`, method: 'GET', body: undefined,
        });
      });

      it('creates a provider with type provider_expense and a whitelisted nested object', async () => {
        stub({ id: 3 }, 201);
        await BankClient.createProviderExpense(context, {
          ...ACCOUNT_ATTRS, ...FORBIDDEN, extra: 'x', provider_expense: { ...PROVIDER_ATTRS, account_id: 3, extra: 'y' },
        });

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts.json`,
          method: 'POST',
          body: { ...ACCOUNT_ATTRS, type: 'provider_expense', provider_expense: PROVIDER_ATTRS },
        });
      });

      it('updates a provider without the type, keeping nulls to clear', async () => {
        stub({ id: 3 });
        await BankClient.updateProviderExpense(context, 3, {
          name: 'Rent', ...FORBIDDEN, provider_expense: { expected_amount: null, due_day: null, unknown: 1, charge_frequency: undefined },
        });

        expect(lastCall()).toEqual({
          path: `${prefix}/bank/accounts/3.json`,
          method: 'PATCH',
          body: { name: 'Rent', provider_expense: { expected_amount: null, due_day: null } },
        });
      });

      it('updates a provider without a provider_expense object', async () => {
        stub({ id: 3 });
        await BankClient.updateProviderExpense(context, 3, { name: 'Rent', provider_expense: null });

        expect(lastCall().body).toEqual({ name: 'Rent' });
      });

      it('strips provider_expense from the other account calls', async () => {
        stub({ id: 12 }, 201);
        await BankClient.createAccount(context, { name: 'Main', provider_expense: PROVIDER_ATTRS });

        expect(lastCall().body).toEqual({ name: 'Main' });

        stub({ id: 7 }, 201);
        await BankClient.createDebt(context, { name: 'Loan', provider_expense: PROVIDER_ATTRS });

        expect(lastCall().body).toEqual({ type: 'debt', name: 'Loan' });
      });
    });
  });

  it('sends only the type for missing attributes', async () => {
    stub({ id: 1 }, 201);
    await BankClient.createProviderExpense({ kind: 'personal' }, undefined);

    expect(lastCall().body).toEqual({ type: 'provider_expense' });
  });
});
